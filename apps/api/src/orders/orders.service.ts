import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { AssignOrderDto } from './dto/assign-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderItemDto } from './dto/order-item.dto.js';
import { OrdersQueryDto } from './dto/orders-query.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type PriceContext = {
  customerId: string;
  priceListId: string | null;
};

type CalculatedItem = {
  tenantId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineSubtotal: number;
  lineTotal: number;
};

@Injectable()
export class OrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: OrdersQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.OrderWhereInput = {
      tenantId,
      status: query.status,
      OR: query.search
        ? [
            { customer: { businessName: { contains: query.search } } },
            { customer: { firstName: { contains: query.search } } },
            { customer: { lastName: { contains: query.search } } }
          ]
        : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: this.includeFull(), orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.order.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const order = await this.prisma.order.findFirst({ where: { id, tenantId }, include: this.includeFull() });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(dto: CreateOrderDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    this.assertItems(dto.items);
    const customer = await this.assertCustomer(dto.customerId, tenantId);
    const delivery = await this.deliverySnapshot(dto, dto.customerId, tenantId);
    const calculated = await this.calculateItems(dto.items, tenantId, customer);
    const totals = this.totals(calculated);

    const order = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextOrderNumber(tx, tenantId);
      const created = await tx.order.create({
        data: {
          tenantId,
          number,
          customerId: dto.customerId,
          deliveryAddressId: delivery.deliveryAddressId,
          createdById: user.id,
          requestedDeliveryAt: dto.requestedDeliveryAt ? new Date(dto.requestedDeliveryAt) : undefined,
          ...delivery.snapshot,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          total: totals.total,
          notes: dto.notes?.trim(),
          items: { create: calculated }
        },
        include: this.includeFull()
      });
      await this.addHistory(tx, tenantId, created.id, user.id, null, created.status, 'orders.create', dto.notes);
      return created;
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'orders.create', entity: 'Order', entityId: order.id, newValues: { customerId: order.customerId, total: order.total } });
    return order;
  }

  async update(id: string, dto: UpdateOrderDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.order.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!current) throw new NotFoundException('Order not found');
    if (current.status === 'CANCELLED' || current.status === 'ASSIGNED') {
      throw new BadRequestException('Assigned or cancelled orders cannot be modified');
    }

    const customerId = dto.customerId ?? current.customerId;
    const customer = await this.assertCustomer(customerId, tenantId);
    const delivery = await this.deliverySnapshot(dto, customerId, tenantId);
    const calculated = dto.items ? await this.calculateItems(dto.items, tenantId, customer) : null;
    if (dto.items) this.assertItems(dto.items);
    const totals = calculated ? this.totals(calculated) : null;

    const order = await this.prisma.$transaction(async (tx) => {
      if (calculated) await tx.orderItem.deleteMany({ where: { orderId: id } });
      const updated = await tx.order.update({
        where: { id },
        data: {
          customerId,
          deliveryAddressId: delivery.deliveryAddressId,
          requestedDeliveryAt: dto.requestedDeliveryAt ? new Date(dto.requestedDeliveryAt) : undefined,
          ...delivery.snapshot,
          subtotal: totals?.subtotal,
          discountTotal: totals?.discountTotal,
          total: totals?.total,
          notes: dto.notes?.trim(),
          items: calculated ? { create: calculated } : undefined
        },
        include: this.includeFull()
      });
      await this.addHistory(tx, tenantId, id, user.id, current.status, updated.status, 'orders.update', dto.notes);
      return updated;
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'orders.update', entity: 'Order', entityId: id, oldValues: { status: current.status, total: current.total }, newValues: { status: order.status, total: order.total } });
    return order;
  }

  async confirm(id: string, user: AuthenticatedUser) {
    return this.transition(id, user, 'CONFIRMED', 'orders.confirm', (current) => {
      if (current.status !== 'DRAFT') throw new BadRequestException('Only draft orders can be confirmed');
      if (!current.items.length) throw new BadRequestException('Order requires at least one item');
      return { confirmedAt: new Date() };
    });
  }

  async retryDelivery(id: string, user: AuthenticatedUser) {
    return this.transition(id, user, 'CONFIRMED', 'orders.retry_delivery', (current) => {
      if (current.status !== 'FAILED_DELIVERY') throw new BadRequestException('Only failed deliveries can be retried');
      if (!current.items.length) throw new BadRequestException('Order requires at least one item');
      return { assignedDriverId: null, assignedVehicleId: null, assignedAt: null, confirmedAt: new Date() };
    }, 'Reintento de entrega desde backoffice');
  }

  async assign(id: string, dto: AssignOrderDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.order.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!current) throw new NotFoundException('Order not found');
    if (current.status !== 'CONFIRMED' && current.status !== 'ASSIGNED') {
      throw new BadRequestException('Only confirmed orders can be assigned');
    }
    await this.assertDriver(dto.driverId, tenantId);
    await this.assertVehicle(dto.vehicleId, tenantId);

    const order = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: 'ASSIGNED',
          assignedDriverId: dto.driverId,
          assignedVehicleId: dto.vehicleId,
          assignedAt: new Date()
        },
        include: this.includeFull()
      });
      await this.addHistory(tx, tenantId, id, user.id, current.status, 'ASSIGNED', 'orders.assign', dto.notes);
      return updated;
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'orders.assign', entity: 'Order', entityId: id, newValues: { driverId: dto.driverId, vehicleId: dto.vehicleId } });
    return order;
  }

  async cancel(id: string, dto: CancelOrderDto, user: AuthenticatedUser) {
    return this.transition(id, user, 'CANCELLED', 'orders.cancel', (current) => {
      if (current.status === 'CANCELLED') throw new BadRequestException('Order is already cancelled');
      return { cancelledAt: new Date(), cancelReason: dto.reason?.trim() };
    }, dto.reason);
  }

  private async transition(
    id: string,
    user: AuthenticatedUser,
    toStatus: OrderStatus,
    action: string,
    data: (current: Prisma.OrderGetPayload<{ include: { items: true } }>) => Prisma.OrderUncheckedUpdateInput,
    notes?: string
  ) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.order.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!current) throw new NotFoundException('Order not found');
    const updateData = data(current);
    const order = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { ...updateData, status: toStatus },
        include: this.includeFull()
      });
      await this.addHistory(tx, tenantId, id, user.id, current.status, toStatus, action, notes);
      return updated;
    });
    await this.audit.log({ tenantId, userId: user.id, action, entity: 'Order', entityId: id, oldValues: { status: current.status }, newValues: { status: order.status } });
    return order;
  }

  private async calculateItems(items: OrderItemDto[], tenantId: string, customer: PriceContext): Promise<CalculatedItem[]> {
    this.assertItems(items);
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, tenantId, active: true } });
    if (products.length !== productIds.length) throw new ForbiddenException('One or more products do not belong to this tenant');

    const [customerPrices, priceListItems] = await Promise.all([
      this.prisma.customerProductPrice.findMany({ where: { tenantId, customerId: customer.customerId, productId: { in: productIds } } }),
      this.prisma.priceListItem.findMany({
        where: customer.priceListId
          ? {
              tenantId,
              productId: { in: productIds },
              priceListId: customer.priceListId
            }
          : { tenantId, id: { in: [] } },
        include: { priceList: true }
      })
    ]);

    const productMap = new Map(products.map((product) => [product.id, product]));
    const customerPriceMap = new Map(customerPrices.map((price) => [price.productId, Number(price.price)]));
    const assignedPriceMap = new Map(priceListItems.filter((item) => item.priceListId === customer.priceListId).map((item) => [item.productId, Number(item.price)]));

    return items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new ForbiddenException('Product does not belong to this tenant');
      const unitPrice = item.unitPrice ?? customerPriceMap.get(item.productId) ?? assignedPriceMap.get(item.productId) ?? Number(product.price);
      const quantity = item.quantity;
      const lineSubtotal = this.money(quantity * unitPrice);
      const discount = this.money(Math.min(item.discount ?? 0, lineSubtotal));
      return {
        tenantId,
        productId: item.productId,
        quantity,
        unitPrice: this.money(unitPrice),
        discount,
        lineSubtotal,
        lineTotal: this.money(lineSubtotal - discount)
      };
    });
  }

  private totals(items: CalculatedItem[]) {
    const subtotal = this.money(items.reduce((sum, item) => sum + item.lineSubtotal, 0));
    const discountTotal = this.money(items.reduce((sum, item) => sum + item.discount, 0));
    return { subtotal, discountTotal, total: this.money(subtotal - discountTotal) };
  }

  private async deliverySnapshot(dto: Partial<CreateOrderDto>, customerId: string, tenantId: string) {
    const explicitSnapshot = {
      deliveryStreet: dto.deliveryStreet?.trim(),
      deliveryStreetNumber: dto.deliveryStreetNumber?.trim(),
      deliveryCity: dto.deliveryCity?.trim(),
      deliveryProvince: dto.deliveryProvince?.trim(),
      deliveryPostalCode: dto.deliveryPostalCode?.trim(),
      deliveryReference: dto.deliveryReference?.trim(),
      deliveryNotes: dto.deliveryNotes?.trim()
    };
    if (Object.values(explicitSnapshot).some(Boolean)) return { deliveryAddressId: dto.deliveryAddressId, snapshot: explicitSnapshot };

    const address = dto.deliveryAddressId
      ? await this.prisma.customerAddress.findFirst({ where: { id: dto.deliveryAddressId, tenantId, customerId } })
      : await this.prisma.customerAddress.findFirst({ where: { tenantId, customerId, isPrimary: true } });
    if (dto.deliveryAddressId && !address) throw new ForbiddenException('Delivery address does not belong to this customer');

    return {
      deliveryAddressId: address?.id ?? dto.deliveryAddressId,
      snapshot: {
        deliveryStreet: address?.street,
        deliveryStreetNumber: address?.streetNumber,
        deliveryCity: address?.city,
        deliveryProvince: address?.province,
        deliveryPostalCode: address?.postalCode,
        deliveryReference: address?.reference,
        deliveryNotes: address?.deliveryNotes
      }
    };
  }

  private assertItems(items: OrderItemDto[] | undefined): void {
    if (!items?.length) throw new BadRequestException('Order requires at least one item');
  }

  private async nextOrderNumber(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
    const latest = await tx.order.aggregate({ where: { tenantId }, _max: { number: true } });
    return (latest._max.number ?? 0) + 1;
  }

  private async assertCustomer(customerId: string, tenantId: string): Promise<PriceContext> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId, status: 'ACTIVE' } });
    if (!customer) throw new ForbiddenException('Customer does not belong to this tenant');
    return { customerId: customer.id, priceListId: customer.priceListId };
  }

  private async assertDriver(driverId: string, tenantId: string): Promise<void> {
    const driver = await this.prisma.driver.findFirst({ where: { id: driverId, tenantId, status: 'ACTIVE' } });
    if (!driver) throw new ForbiddenException('Driver does not belong to this tenant');
  }

  private async assertVehicle(vehicleId: string, tenantId: string): Promise<void> {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId, status: 'ACTIVE' } });
    if (!vehicle) throw new ForbiddenException('Vehicle does not belong to this tenant');
  }

  private async addHistory(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderId: string,
    userId: string,
    fromStatus: OrderStatus | null,
    toStatus: OrderStatus,
    action: string,
    notes?: string
  ): Promise<void> {
    await tx.orderHistory.create({ data: { tenantId, orderId, userId, fromStatus, toStatus, action, notes: notes?.trim() } });
  }

  private includeFull() {
    return {
      customer: true,
      deliveryAddress: true,
      assignedDriver: { include: { user: true } },
      assignedVehicle: true,
      items: { include: { product: true } },
      history: { orderBy: { createdAt: 'asc' as const }, include: { user: true } }
    };
  }

  private money(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
