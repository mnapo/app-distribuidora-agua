import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { DeliveryRouteStatus, InventoryLocation, OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { CreateDeliveryRouteDto } from './dto/create-delivery-route.dto.js';
import { DeliveryRoutesQueryDto } from './dto/delivery-routes-query.dto.js';
import { RouteActionDto } from './dto/route-action.dto.js';
import { RouteOrderDto } from './dto/route-order.dto.js';
import { UpdateDeliveryRouteDto } from './dto/update-delivery-route.dto.js';
import { pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type StockLocation = {
  warehouseId?: string;
  vehicleId?: string;
};

type RouteOrderForClosing = Prisma.DeliveryRouteOrderGetPayload<{
  include: {
    order: true;
    deliveredItems: { include: { product: true } };
    invoices: true;
  };
}>;

@Injectable()
export class DeliveryRoutesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: DeliveryRoutesQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.DeliveryRouteWhereInput = {
      tenantId,
      status: query.status,
      name: query.search ? { contains: query.search } : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.deliveryRoute.findMany({ where, include: this.includeFull(), orderBy: { routeDate: 'desc' }, ...pageArgs(query) }),
      this.prisma.deliveryRoute.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const route = await this.prisma.deliveryRoute.findFirst({ where: { id, tenantId }, include: this.includeFull() });
    if (!route) throw new NotFoundException('Delivery route not found');
    return route;
  }

  async create(dto: CreateDeliveryRouteDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    this.assertRouteOrders(dto.orders);
    await this.assertWarehouse(dto.warehouseId, tenantId);
    await this.assertDriver(dto.driverId, tenantId);
    await this.assertVehicle(dto.vehicleId, tenantId);
    await this.assertOrdersAvailable(dto.orders, tenantId);

    const route = await this.prisma.$transaction(async (tx) => {
      const created = await tx.deliveryRoute.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          routeDate: new Date(dto.routeDate),
          warehouseId: dto.warehouseId,
          driverId: dto.driverId,
          vehicleId: dto.vehicleId,
          notes: dto.notes?.trim(),
          orders: { create: dto.orders.map((item) => ({ tenantId, orderId: item.orderId, sequence: item.sequence })) }
        },
        include: this.includeFull()
      });
      await this.markOrdersAssigned(tx, tenantId, dto.orders, dto.driverId, dto.vehicleId);
      await this.addHistory(tx, tenantId, created.id, user.id, null, created.status, 'delivery_routes.create', dto.notes);
      return created;
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'delivery_routes.create', entity: 'DeliveryRoute', entityId: route.id, newValues: { name: route.name, orders: dto.orders.length } });
    return route;
  }

  async update(id: string, dto: UpdateDeliveryRouteDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.deliveryRoute.findFirst({ where: { id, tenantId }, include: { orders: { include: { order: true } } } });
    if (!current) throw new NotFoundException('Delivery route not found');
    if (current.status !== 'DRAFT') throw new BadRequestException('Only draft routes can be modified');

    const warehouseId = dto.warehouseId ?? current.warehouseId;
    const driverId = dto.driverId ?? current.driverId;
    const vehicleId = dto.vehicleId ?? current.vehicleId;
    await this.assertWarehouse(warehouseId, tenantId);
    await this.assertDriver(driverId, tenantId);
    await this.assertVehicle(vehicleId, tenantId);
    if (dto.orders) {
      this.assertRouteOrders(dto.orders);
      await this.assertOrdersAvailable(dto.orders, tenantId, id);
    }

    const route = await this.prisma.$transaction(async (tx) => {
      if (dto.orders) {
        const nextOrderIds = new Set(dto.orders.map((item) => item.orderId));
        const removedOrders = current.orders.filter((routeOrder) => !nextOrderIds.has(routeOrder.orderId));

        for (const routeOrder of removedOrders) {
          await tx.order.update({
            where: { id: routeOrder.orderId },
            data: {
              status: 'CONFIRMED',
              assignedDriverId: null,
              assignedVehicleId: null,
              assignedAt: null
            }
          });
          await this.addOrderHistory(tx, tenantId, routeOrder.orderId, user.id, routeOrder.order.status, 'CONFIRMED', 'delivery_routes.update', dto.notes);
        }

        await tx.deliveryRouteOrder.deleteMany({ where: { routeId: id } });
      }
      const updated = await tx.deliveryRoute.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          routeDate: dto.routeDate ? new Date(dto.routeDate) : undefined,
          warehouseId,
          driverId,
          vehicleId,
          notes: dto.notes?.trim(),
          orders: dto.orders ? { create: dto.orders.map((item) => ({ tenantId, orderId: item.orderId, sequence: item.sequence })) } : undefined
        },
        include: this.includeFull()
      });
      await this.markOrdersAssigned(tx, tenantId, dto.orders ?? current.orders, driverId, vehicleId);
      await this.addHistory(tx, tenantId, id, user.id, current.status, updated.status, 'delivery_routes.update', dto.notes);
      return updated;
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'delivery_routes.update', entity: 'DeliveryRoute', entityId: id, oldValues: { status: current.status }, newValues: { name: route.name } });
    return route;
  }

  async prepare(id: string, dto: RouteActionDto, user: AuthenticatedUser) {
    return this.transition(id, user, 'PREPARED', 'delivery_routes.prepare', (current) => {
      if (current.status !== 'DRAFT') throw new BadRequestException('Only draft routes can be prepared');
      if (!current.orders.length) throw new BadRequestException('Route requires at least one order');
      return { preparedAt: new Date() };
    }, dto.notes);
  }

  async loadVehicle(id: string, dto: RouteActionDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.deliveryRoute.findFirst({ where: { id, tenantId }, include: this.includeForLoading() });
    if (!current) throw new NotFoundException('Delivery route not found');
    if (current.status !== 'PREPARED') throw new BadRequestException('Only prepared routes can be loaded');

    const requiredByProduct = new Map<string, number>();
    for (const routeOrder of current.orders) {
      for (const item of routeOrder.order.items) {
        requiredByProduct.set(item.productId, (requiredByProduct.get(item.productId) ?? 0) + Number(item.quantity));
      }
    }
    if (!requiredByProduct.size) throw new BadRequestException('Route has no products to load');

    const route = await this.prisma.$transaction(async (tx) => {
      for (const [productId, quantity] of requiredByProduct) {
        await this.applyStockChange(tx, tenantId, productId, { warehouseId: current.warehouseId }, -quantity);
        await this.applyStockChange(tx, tenantId, productId, { vehicleId: current.vehicleId }, quantity);
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            productId,
            type: 'VEHICLE_LOAD',
            quantity,
            fromWarehouseId: current.warehouseId,
            vehicleId: current.vehicleId,
            userId: user.id,
            reason: 'Carga de ruta',
            reference: id
          }
        });
      }
      const updated = await tx.deliveryRoute.update({ where: { id }, data: { status: 'LOADED', loadedAt: new Date() }, include: this.includeFull() });
      await this.addHistory(tx, tenantId, id, user.id, current.status, 'LOADED', 'delivery_routes.load_vehicle', dto.notes);
      return updated;
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'delivery_routes.load_vehicle', entity: 'DeliveryRoute', entityId: id, newValues: { productCount: requiredByProduct.size } });
    return route;
  }

  async closePreliminary(id: string, dto: RouteActionDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.deliveryRoute.findFirst({
      where: { id, tenantId },
      include: this.includeForClosing()
    });
    if (!current) throw new NotFoundException('Delivery route not found');
    if (current.status !== 'LOADED') throw new BadRequestException('Only loaded routes can be closed preliminarily');
    if (current.orders.some((routeOrder) => routeOrder.stopStatus === 'PENDING')) {
      throw new BadRequestException('Route has pending stops');
    }

    const route = await this.prisma.$transaction(async (tx) => {
      for (const routeOrder of current.orders) {
        if (routeOrder.stopStatus === 'DELIVERED') {
          const invoice = await this.createInvoiceForDeliveredStop(tx, tenantId, routeOrder);
          await this.applyCollectedPayment(tx, tenantId, routeOrder, invoice);
          await tx.order.update({
            where: { id: routeOrder.orderId },
            data: { status: 'DELIVERED' }
          });
          await this.addOrderHistory(tx, tenantId, routeOrder.orderId, user.id, routeOrder.order.status, 'DELIVERED', 'delivery_routes.close_preliminary', dto.notes);
        }
        if (routeOrder.stopStatus === 'FAILED') {
          await tx.order.update({
            where: { id: routeOrder.orderId },
            data: {
              status: 'FAILED_DELIVERY',
              assignedDriverId: null,
              assignedVehicleId: null,
              assignedAt: null
            }
          });
          await this.addOrderHistory(tx, tenantId, routeOrder.orderId, user.id, routeOrder.order.status, 'FAILED_DELIVERY', 'delivery_routes.close_preliminary', routeOrder.failureReason ?? dto.notes);
        }
      }

      const updated = await tx.deliveryRoute.update({ where: { id }, data: { status: 'CLOSED_PRELIMINARY', closedAt: new Date() }, include: this.includeFull() });
      await this.addHistory(tx, tenantId, id, user.id, current.status, 'CLOSED_PRELIMINARY', 'delivery_routes.close_preliminary', dto.notes);
      return updated;
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'delivery_routes.close_preliminary', entity: 'DeliveryRoute', entityId: id, oldValues: { status: current.status }, newValues: { status: route.status } });
    return route;
  }

  async cancel(id: string, dto: RouteActionDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.deliveryRoute.findFirst({ where: { id, tenantId }, include: { orders: { include: { order: true } } } });
    if (!current) throw new NotFoundException('Delivery route not found');
    if (current.status === 'LOADED' || current.status === 'CLOSED_PRELIMINARY') {
      throw new BadRequestException('Loaded or closed routes cannot be cancelled in this stage');
    }
    if (current.status === 'CANCELLED') throw new BadRequestException('Route is already cancelled');

    const route = await this.prisma.$transaction(async (tx) => {
      for (const routeOrder of current.orders) {
        await tx.order.update({
          where: { id: routeOrder.orderId },
          data: {
            status: 'CONFIRMED',
            assignedDriverId: null,
            assignedVehicleId: null,
            assignedAt: null
          }
        });
        await this.addOrderHistory(tx, tenantId, routeOrder.orderId, user.id, routeOrder.order.status, 'CONFIRMED', 'delivery_routes.cancel', dto.notes);
      }
      const updated = await tx.deliveryRoute.update({ where: { id }, data: { status: 'CANCELLED' }, include: this.includeFull() });
      await this.addHistory(tx, tenantId, id, user.id, current.status, 'CANCELLED', 'delivery_routes.cancel', dto.notes);
      return updated;
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'delivery_routes.cancel', entity: 'DeliveryRoute', entityId: id, oldValues: { status: current.status }, newValues: { status: route.status } });
    return route;
  }

  private async transition(
    id: string,
    user: AuthenticatedUser,
    toStatus: DeliveryRouteStatus,
    action: string,
    data: (current: Prisma.DeliveryRouteGetPayload<{ include: { orders: true } }>) => Prisma.DeliveryRouteUncheckedUpdateInput,
    notes?: string
  ) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.deliveryRoute.findFirst({ where: { id, tenantId }, include: { orders: true } });
    if (!current) throw new NotFoundException('Delivery route not found');
    const updateData = data(current);
    const route = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryRoute.update({ where: { id }, data: { ...updateData, status: toStatus }, include: this.includeFull() });
      await this.addHistory(tx, tenantId, id, user.id, current.status, toStatus, action, notes);
      return updated;
    });
    await this.audit.log({ tenantId, userId: user.id, action, entity: 'DeliveryRoute', entityId: id, oldValues: { status: current.status }, newValues: { status: route.status } });
    return route;
  }

  private async markOrdersAssigned(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orders: { orderId: string }[],
    driverId: string,
    vehicleId: string
  ): Promise<void> {
    await tx.order.updateMany({
      where: { tenantId, id: { in: orders.map((item) => item.orderId) } },
      data: { status: 'ASSIGNED', assignedDriverId: driverId, assignedVehicleId: vehicleId, assignedAt: new Date() }
    });
  }

  private async createInvoiceForDeliveredStop(
    tx: Prisma.TransactionClient,
    tenantId: string,
    routeOrder: RouteOrderForClosing
  ) {
    const existing = routeOrder.invoices.find((invoice) => invoice.status !== 'VOID');
    if (existing) return existing;

    const items = routeOrder.deliveredItems.map((item) => ({
      tenantId,
      description: item.product.name,
      productId: item.productId,
      quantity: Number(item.deliveredQuantity),
      unitPrice: Number(item.unitPrice),
      tax: Number(item.product.tax ?? 0),
      lineTotal: Number(item.lineTotal)
    }));
    if (!items.length) throw new BadRequestException('Delivered stop requires at least one delivered item');

    const subtotal = this.money(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const taxTotal = this.money(items.reduce((sum, item) => sum + (item.lineTotal * item.tax) / 100, 0));
    const total = this.money(subtotal + taxTotal);
    const number = await this.nextInvoiceNumber(tx, tenantId);
    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        customerId: routeOrder.order.customerId,
        orderId: routeOrder.orderId,
        routeOrderId: routeOrder.id,
        number,
        subtotal,
        taxTotal,
        total,
        paidTotal: 0,
        balance: total,
        notes: `Generada al cerrar ruta ${routeOrder.routeId}`,
        items: { create: items }
      }
    });
    await this.createAccountMovement(tx, tenantId, routeOrder.order.customerId, { invoiceId: invoice.id, orderId: routeOrder.orderId, type: 'INVOICE', debit: total, credit: 0, description: `Factura ${number}` });
    return invoice;
  }

  private async applyCollectedPayment(
    tx: Prisma.TransactionClient,
    tenantId: string,
    routeOrder: RouteOrderForClosing,
    invoice: { id: string; total: Prisma.Decimal | number; paidTotal: Prisma.Decimal | number; balance: Prisma.Decimal | number }
  ): Promise<void> {
    const collectedAmount = this.money(Number(routeOrder.collectedAmount));
    if (collectedAmount <= 0) return;

    const invoiceBalance = this.money(Number(invoice.balance));
    const allocatedAmount = this.money(Math.min(collectedAmount, invoiceBalance));
    const payment = await tx.payment.create({
      data: {
        tenantId,
        customerId: routeOrder.order.customerId,
        amount: collectedAmount,
        unappliedAmount: this.money(collectedAmount - allocatedAmount),
        method: routeOrder.paymentMethod as PaymentMethod,
        reference: `Ruta ${routeOrder.routeId} parada ${routeOrder.sequence}`,
        notes: routeOrder.observations
      }
    });

    if (allocatedAmount > 0) {
      await tx.paymentAllocation.create({ data: { tenantId, paymentId: payment.id, invoiceId: invoice.id, amount: allocatedAmount } });
      const paidTotal = this.money(Number(invoice.paidTotal) + allocatedAmount);
      const balance = this.money(Number(invoice.total) - paidTotal);
      await tx.invoice.update({ where: { id: invoice.id }, data: { paidTotal, balance, status: balance <= 0 ? 'PAID' : 'PARTIALLY_PAID' } });
    }

    await this.createAccountMovement(tx, tenantId, routeOrder.order.customerId, { paymentId: payment.id, orderId: routeOrder.orderId, type: 'PAYMENT', debit: 0, credit: collectedAmount, description: `Pago ruta ${routeOrder.routeId}` });
  }

  private async createAccountMovement(
    tx: Prisma.TransactionClient,
    tenantId: string,
    customerId: string,
    input: { invoiceId?: string; paymentId?: string; orderId?: string; type: 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT'; debit: number; credit: number; description: string }
  ): Promise<void> {
    const last = await tx.accountMovement.findFirst({ where: { tenantId, customerId }, orderBy: { createdAt: 'desc' } });
    const balanceAfter = this.money(Number(last?.balanceAfter ?? 0) + input.debit - input.credit);
    await tx.accountMovement.create({ data: { tenantId, customerId, ...input, balanceAfter } });
  }

  private async nextInvoiceNumber(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
    const count = await tx.invoice.count({ where: { tenantId } });
    return `FAC-${String(count + 1).padStart(8, '0')}`;
  }

  private async applyStockChange(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    location: StockLocation,
    delta: number
  ): Promise<void> {
    const warehouseId = location.warehouseId ?? null;
    const vehicleId = location.vehicleId ?? null;
    const locationType: InventoryLocation = vehicleId ? 'VEHICLE' : 'WAREHOUSE';
    if (!warehouseId && !vehicleId) throw new BadRequestException('Inventory location is required');

    const current = await tx.inventory.findFirst({ where: { tenantId, productId, warehouseId, vehicleId } });
    if (current) {
      await tx.inventory.update({ where: { id: current.id }, data: { quantity: { increment: delta } } });
      return;
    }
    await tx.inventory.create({ data: { tenantId, productId, warehouseId, vehicleId, locationType, quantity: delta } });
  }

  private assertRouteOrders(orders: RouteOrderDto[] | undefined): void {
    if (!orders?.length) throw new BadRequestException('Route requires at least one order');
    const orderIds = new Set(orders.map((item) => item.orderId));
    const sequences = new Set(orders.map((item) => item.sequence));
    if (orderIds.size !== orders.length) throw new BadRequestException('Route cannot include duplicated orders');
    if (sequences.size !== orders.length) throw new BadRequestException('Route cannot include duplicated sequences');
  }

  private async assertOrdersAvailable(orders: RouteOrderDto[], tenantId: string, currentRouteId?: string): Promise<void> {
    const orderIds = orders.map((item) => item.orderId);
    const count = await this.prisma.order.count({ where: { tenantId, id: { in: orderIds }, status: { in: ['CONFIRMED', 'ASSIGNED', 'FAILED_DELIVERY'] } } });
    if (count !== orderIds.length) throw new ForbiddenException('One or more orders are not available for routing');
    const assigned = await this.prisma.deliveryRouteOrder.count({
      where: {
        tenantId,
        orderId: { in: orderIds },
        routeId: currentRouteId ? { not: currentRouteId } : undefined,
        route: { status: { not: 'CANCELLED' } },
        NOT: { stopStatus: 'FAILED', route: { status: 'CLOSED_PRELIMINARY' } }
      }
    });
    if (assigned) throw new BadRequestException('One or more orders are already assigned to another route');
  }

  private async assertWarehouse(warehouseId: string, tenantId: string): Promise<void> {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId, active: true } });
    if (!warehouse) throw new ForbiddenException('Warehouse does not belong to this tenant');
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
    routeId: string,
    userId: string,
    fromStatus: DeliveryRouteStatus | null,
    toStatus: DeliveryRouteStatus,
    action: string,
    notes?: string
  ): Promise<void> {
    await tx.deliveryRouteHistory.create({ data: { tenantId, routeId, userId, fromStatus, toStatus, action, notes: notes?.trim() } });
  }

  private async addOrderHistory(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderId: string,
    userId: string,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    action: string,
    notes?: string | null
  ): Promise<void> {
    await tx.orderHistory.create({ data: { tenantId, orderId, userId, fromStatus, toStatus, action, notes: notes?.trim() } });
  }

  private includeFull() {
    return {
      warehouse: true,
      driver: { include: { user: true } },
      vehicle: true,
      orders: { orderBy: { sequence: 'asc' as const }, include: { order: { include: { customer: true, items: { include: { product: true } }, invoices: true } }, deliveredItems: { include: { product: true } }, invoices: true } },
      history: { orderBy: { createdAt: 'asc' as const }, include: { user: true } }
    };
  }

  private includeForLoading() {
    return {
      orders: { include: { order: { include: { items: true } } } }
    };
  }

  private includeForClosing() {
    return {
      orders: {
        include: {
          order: true,
          deliveredItems: { include: { product: true } },
          invoices: true
        }
      }
    };
  }

  private money(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
