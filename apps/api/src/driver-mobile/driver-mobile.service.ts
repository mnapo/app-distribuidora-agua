import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryEvidenceType, DeliveryStopItemSource, InventoryLocation, Prisma } from '@prisma/client';
import { CompleteStopDto } from './dto/complete-stop.dto.js';
import { CreateMobilePaymentDto } from './dto/create-mobile-payment.dto.js';
import { CreateMobileSaleDto } from './dto/create-mobile-sale.dto.js';
import { CreateQuickCustomerDto } from './dto/create-quick-customer.dto.js';
import { DeliveryItemDto } from './dto/delivery-item.dto.js';
import { FailStopDto } from './dto/fail-stop.dto.js';
import { SyncOperationDto, SyncOperationsDto } from './dto/sync-operation.dto.js';
import { BillingService } from '../billing/billing.service.js';
import { OrderItemDto } from '../orders/dto/order-item.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.types.js';

type RouteOrderForStop = Prisma.DeliveryRouteOrderGetPayload<{
  include: {
    route: { include: { driver: true; vehicle: true } };
    order: { include: { deliveryAddress: true; items: { include: { product: true } } } };
  };
}>;

@Injectable()
export class DriverMobileService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly audit: AuditService,
    @Inject(BillingService)
    private readonly billing: BillingService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider
  ) {}

  async assignedRoutes(user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const driver = await this.driverForUser(user.id, tenantId);
    return this.prisma.deliveryRoute.findMany({
      where: { tenantId, driverId: driver.id, status: 'LOADED' },
      include: this.routeInclude(),
      orderBy: { routeDate: 'asc' }
    });
  }

  async routeDetail(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const driver = await this.driverForUser(user.id, tenantId);
    const route = await this.prisma.deliveryRoute.findFirst({ where: { id, tenantId, driverId: driver.id }, include: this.routeInclude() });
    if (!route) throw new NotFoundException('Route not found for driver');
    return route;
  }

  async catalog(user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.driverForUser(user.id, tenantId);
    const [customers, products] = await Promise.all([
      this.prisma.customer.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { priceList: { include: { items: true } }, customerProductPrices: true },
        orderBy: [{ businessName: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }]
      }),
      this.prisma.product.findMany({
        where: { tenantId, active: true },
        include: { category: true },
        orderBy: { name: 'asc' }
      })
    ]);
    return { customers, products };
  }

  async createQuickCustomer(dto: CreateQuickCustomerDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.driverForUser(user.id, tenantId);
    const customer = await this.prisma.customer.create({
      data: {
        tenantId,
        type: 'COMPANY',
        businessName: dto.name.trim(),
        phone: dto.phone?.trim(),
        notes: dto.notes?.trim(),
        status: 'ACTIVE',
        addresses: dto.address?.trim()
          ? { create: [{ tenantId, street: dto.address.trim(), isPrimary: true, contactName: dto.name.trim(), contactPhone: dto.phone?.trim() }] }
          : undefined
      },
      include: { addresses: true, priceList: true }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'driver_mobile.create_customer', entity: 'Customer', entityId: customer.id, newValues: { name: dto.name } });
    return customer;
  }

  async customerDebt(customerId: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.driverForUser(user.id, tenantId);
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId, status: 'ACTIVE' } });
    if (!customer) throw new NotFoundException('Customer not found');
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, customerId, balance: { gt: 0 }, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
      include: { order: true },
      orderBy: [{ dueAt: 'asc' }, { issuedAt: 'asc' }]
    });
    const balance = this.money(invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0));
    return { customer, balance, invoices };
  }

  async createPayment(dto: CreateMobilePaymentDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.driverForUser(user.id, tenantId);
    const payment = await this.billing.createAutoAllocatedPayment(
      {
        customerId: dto.customerId,
        amount: dto.amount,
        method: dto.method ?? 'TRANSFER',
        reference: dto.reference?.trim() ?? 'Pago registrado desde movil',
        notes: dto.notes?.trim()
      },
      user
    );
    await this.audit.log({ tenantId, userId: user.id, action: 'driver_mobile.create_payment', entity: 'Payment', entityId: payment.id, newValues: { amount: dto.amount, customerId: dto.customerId } });
    return payment;
  }

  async createQuickSale(dto: CreateMobileSaleDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const route = await this.findOrCreateDailyRoute(user, tenantId);
    return this.createRouteSale(route.id, dto, user);
  }

  async createRouteSale(routeId: string, dto: CreateMobileSaleDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const driver = await this.driverForUser(user.id, tenantId);
    if (!dto.items.length) throw new BadRequestException('Sale requires at least one item');

    const route = await this.prisma.deliveryRoute.findFirst({
      where: { id: routeId, tenantId, driverId: driver.id, status: 'LOADED' },
      include: { orders: true, vehicle: true }
    });
    if (!route) throw new NotFoundException('Route not found for driver');

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId, status: 'ACTIVE' }
    });
    if (!customer) throw new ForbiddenException('Customer does not belong to this tenant');

    const calculated = await this.calculateSaleItems(dto.items, tenantId, customer.id, customer.priceListId);
    const total = this.money(calculated.reduce((sum, item) => sum + item.lineTotal, 0));
    const nextSequence = Math.max(0, ...route.orders.map((item) => item.sequence)) + 1;

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId,
          customerId: customer.id,
          createdById: user.id,
          status: 'ASSIGNED',
          assignedDriverId: driver.id,
          assignedVehicleId: route.vehicleId,
          assignedAt: new Date(),
          deliveryNotes: dto.deliveryNotes?.trim(),
          notes: dto.notes?.trim() ?? 'Venta movil',
          subtotal: total,
          discountTotal: 0,
          total,
          items: { create: calculated }
        }
      });
      await tx.orderHistory.create({
        data: { tenantId, orderId: order.id, userId: user.id, fromStatus: null, toStatus: 'ASSIGNED', action: 'driver_mobile.create_sale', notes: dto.notes?.trim() ?? 'Venta movil' }
      });

      const routeOrder = await tx.deliveryRouteOrder.create({
        data: {
          tenantId,
          routeId,
          orderId: order.id,
          sequence: nextSequence
        },
        include: this.stopInclude()
      });

      return routeOrder;
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'driver_mobile.create_sale', entity: 'DeliveryRouteOrder', entityId: result.id, newValues: { customerId: customer.id, total } });
    return result;
  }

  async completeStop(routeOrderId: string, dto: CompleteStopDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const duplicate = await this.findDuplicate(tenantId, dto.idempotencyKey);
    if (duplicate) return duplicate;

    const routeOrder = await this.assertRouteOrderForDriver(routeOrderId, user, tenantId);
    if (routeOrder.stopStatus === 'DELIVERED') throw new BadRequestException('Stop is already delivered');
    if (routeOrder.stopStatus === 'FAILED') throw new BadRequestException('Failed stop cannot be completed');
    await this.assertTenantDeliveryRules(tenantId, dto, routeOrder);
    const normalizedItems = await this.normalizeItems(dto.items, routeOrder, tenantId);
    const distance = this.distanceToCustomer(routeOrder, dto.latitude, dto.longitude);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.deliveryStopItem.deleteMany({ where: { routeOrderId } });
      for (const item of normalizedItems) {
        await this.applyVehicleDelivery(tx, tenantId, routeOrder.route.vehicleId, item.productId, item.deliveredQuantity, user.id, routeOrderId);
        await tx.deliveryStopItem.create({
          data: {
            tenantId,
            routeOrderId,
            productId: item.productId,
            source: item.source,
            orderedQuantity: item.orderedQuantity,
            deliveredQuantity: item.deliveredQuantity,
            unitPrice: item.unitPrice,
            lineTotal: this.money(item.unitPrice * item.deliveredQuantity)
          }
        });
      }
      await this.syncOrderWithDeliveredItems(tx, tenantId, routeOrder.orderId, normalizedItems);
      const updated = await tx.deliveryRouteOrder.update({
        where: { id: routeOrderId },
        data: {
          stopStatus: 'DELIVERED',
          deliveredAt: new Date(),
          observations: dto.observations?.trim(),
          collectedAmount: dto.collectedAmount ?? 0,
          paymentMethod: dto.paymentMethod ?? 'CASH',
          deliveryLatitude: dto.latitude,
          deliveryLongitude: dto.longitude,
          deliveryAccuracy: dto.accuracy,
          distanceToCustomerMeters: distance
        },
        include: this.stopInclude()
      });
      await this.saveEvidence(tx, tenantId, routeOrderId, 'SIGNATURE', dto.signatureBase64);
      await this.saveEvidence(tx, tenantId, routeOrderId, 'PHOTO', dto.photoBase64);
      await tx.offlineSyncOperation.create({
        data: { tenantId, userId: user.id, idempotencyKey: dto.idempotencyKey, action: 'complete_stop', payload: dto as unknown as Prisma.InputJsonValue, result: this.jsonResult(updated) }
      });
      return updated;
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'driver_mobile.complete_stop', entity: 'DeliveryRouteOrder', entityId: routeOrderId, newValues: { collectedAmount: dto.collectedAmount ?? 0 } });
    return result;
  }

  async failStop(routeOrderId: string, dto: FailStopDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const duplicate = await this.findDuplicate(tenantId, dto.idempotencyKey);
    if (duplicate) return duplicate;

    const routeOrder = await this.assertRouteOrderForDriver(routeOrderId, user, tenantId);
    if (routeOrder.stopStatus !== 'PENDING') throw new BadRequestException('Only pending stops can be failed');
    const settings = await this.tenantSettings(tenantId);
    if (settings.gpsMode === 'REQUIRED' && (!dto.latitude || !dto.longitude)) throw new BadRequestException('GPS coordinates are required');
    if (settings.deliveryPhotoMode === 'REQUIRED' && !dto.photoBase64) throw new BadRequestException('Photo is required');
    const distance = this.distanceToCustomer(routeOrder, dto.latitude, dto.longitude);

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryRouteOrder.update({
        where: { id: routeOrderId },
        data: {
          stopStatus: 'FAILED',
          failedAt: new Date(),
          failureReason: dto.reason.trim(),
          observations: dto.observations?.trim(),
          deliveryLatitude: dto.latitude,
          deliveryLongitude: dto.longitude,
          deliveryAccuracy: dto.accuracy,
          distanceToCustomerMeters: distance
        },
        include: this.stopInclude()
      });
      await this.saveEvidence(tx, tenantId, routeOrderId, 'PHOTO', dto.photoBase64);
      await tx.offlineSyncOperation.create({
        data: { tenantId, userId: user.id, idempotencyKey: dto.idempotencyKey, action: 'fail_stop', payload: dto as unknown as Prisma.InputJsonValue, result: this.jsonResult(updated) }
      });
      return updated;
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'driver_mobile.fail_stop', entity: 'DeliveryRouteOrder', entityId: routeOrderId, newValues: { reason: dto.reason } });
    return result;
  }

  async sync(dto: SyncOperationsDto, user: AuthenticatedUser) {
    const results = [];
    for (const operation of dto.operations) {
      try {
        const result =
          operation.action === 'complete_stop'
            ? await this.completeStop(operation.routeOrderId, { ...(operation.payload as Partial<CompleteStopDto>), idempotencyKey: operation.idempotencyKey } as CompleteStopDto, user)
            : await this.failStop(operation.routeOrderId, { ...(operation.payload as Partial<FailStopDto>), idempotencyKey: operation.idempotencyKey } as FailStopDto, user);
        results.push({ idempotencyKey: operation.idempotencyKey, status: 'APPLIED', result });
      } catch (error) {
        await this.recordFailedSync(operation, user, error);
        results.push({ idempotencyKey: operation.idempotencyKey, status: 'FAILED', error: error instanceof Error ? error.message : 'Sync failed' });
      }
    }
    return { results };
  }

  private async findDuplicate(tenantId: string, idempotencyKey: string) {
    const duplicate = await this.prisma.offlineSyncOperation.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
    if (!duplicate) return null;
    return duplicate.result ?? { id: duplicate.id, status: duplicate.status };
  }

  private async recordFailedSync(operation: SyncOperationDto, user: AuthenticatedUser, error: unknown): Promise<void> {
    const tenantId = requireTenant(user);
    const message = error instanceof Error ? error.message : 'Sync failed';
    await this.prisma.offlineSyncOperation
      .upsert({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: operation.idempotencyKey } },
        update: { status: 'FAILED', error: message },
        create: { tenantId, userId: user.id, idempotencyKey: operation.idempotencyKey, action: operation.action, payload: operation.payload as Prisma.InputJsonValue, status: 'FAILED', error: message }
      })
      .catch(() => undefined);
  }

  private async assertRouteOrderForDriver(routeOrderId: string, user: AuthenticatedUser, tenantId: string): Promise<RouteOrderForStop> {
    const driver = await this.driverForUser(user.id, tenantId);
    const routeOrder = await this.prisma.deliveryRouteOrder.findFirst({
      where: { id: routeOrderId, tenantId, route: { driverId: driver.id, status: 'LOADED' } },
      include: {
        route: { include: { driver: true, vehicle: true } },
        order: { include: { deliveryAddress: true, items: { include: { product: true } } } }
      }
    });
    if (!routeOrder) throw new NotFoundException('Stop not found for driver');
    return routeOrder;
  }

  private async driverForUser(userId: string, tenantId: string) {
    const driver = await this.prisma.driver.findFirst({ where: { tenantId, userId, status: 'ACTIVE' } });
    if (!driver) throw new ForbiddenException('Authenticated user is not an active driver');
    return driver;
  }

  private async findOrCreateDailyRoute(user: AuthenticatedUser, tenantId: string) {
    const driver = await this.driverForUser(user.id, tenantId);
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const existing = await this.prisma.deliveryRoute.findFirst({
      where: { tenantId, driverId: driver.id, status: 'LOADED', routeDate: { gte: start, lte: end } },
      orderBy: { createdAt: 'desc' }
    });
    if (existing) return existing;

    const [warehouse, vehicle] = await Promise.all([
      this.prisma.warehouse.findFirst({ where: { tenantId, active: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.vehicle.findFirst({ where: { tenantId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
    ]);
    if (!warehouse) throw new BadRequestException('No hay un deposito activo para crear la ruta automatica');
    if (!vehicle) throw new BadRequestException('No hay un vehiculo activo para crear la ruta automatica');

    const route = await this.prisma.deliveryRoute.create({
      data: {
        tenantId,
        name: `Reparto movil ${today.toISOString().slice(0, 10)}`,
        routeDate: start,
        warehouseId: warehouse.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        status: 'LOADED',
        preparedAt: new Date(),
        loadedAt: new Date(),
        notes: 'Ruta automatica creada desde movil',
        history: { create: [{ tenantId, userId: user.id, fromStatus: null, toStatus: 'LOADED', action: 'driver_mobile.create_daily_route', notes: 'Ruta automatica creada desde movil' }] }
      }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'driver_mobile.create_daily_route', entity: 'DeliveryRoute', entityId: route.id, newValues: { driverId: driver.id, vehicleId: vehicle.id } });
    return route;
  }

  private async assertTenantDeliveryRules(tenantId: string, dto: CompleteStopDto, routeOrder: RouteOrderForStop): Promise<void> {
    const settings = await this.tenantSettings(tenantId);
    if (settings.gpsMode === 'REQUIRED' && (!dto.latitude || !dto.longitude)) throw new BadRequestException('GPS coordinates are required');
    if (settings.requiresSignature && !dto.signatureBase64) throw new BadRequestException('Signature is required');
    if (settings.deliveryPhotoMode === 'REQUIRED' && !dto.photoBase64) throw new BadRequestException('Photo is required');
    const ordered = new Map(routeOrder.order.items.map((item) => [item.productId, Number(item.quantity)]));
    const hasQuantityChange = dto.items.some((item) => (item.source ?? 'ORDER_ITEM') === 'ORDER_ITEM' && ordered.get(item.productId) !== item.deliveredQuantity);
    if (hasQuantityChange && !settings.allowDeliveryQuantityChanges) throw new BadRequestException('Quantity changes are not allowed');
    const hasAdditional = dto.items.some((item) => item.source === 'ADDITIONAL');
    if (hasAdditional && !settings.allowMobileAdditionalSales) throw new BadRequestException('Additional mobile sales are not allowed');
  }

  private async normalizeItems(items: DeliveryItemDto[], routeOrder: RouteOrderForStop, tenantId: string) {
    if (!items.length) throw new BadRequestException('Delivered items are required');
    const ordered = new Map(routeOrder.order.items.map((item) => [item.productId, { quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) }]));
    const productIds = [...new Set(items.map((item) => item.productId))];
    const activeProducts = await this.prisma.product.count({ where: { tenantId, id: { in: productIds }, active: true } });
    if (activeProducts !== productIds.length) throw new ForbiddenException('One or more products do not belong to this tenant');
    return items.map((item) => {
      const source = (item.source ?? 'ORDER_ITEM') as DeliveryStopItemSource;
      const orderedItem = ordered.get(item.productId);
      if (source === 'ORDER_ITEM' && !orderedItem) throw new BadRequestException('Delivered product is not part of the order');
      return {
        productId: item.productId,
        source,
        orderedQuantity: source === 'ORDER_ITEM' ? (item.orderedQuantity ?? orderedItem?.quantity ?? 0) : item.orderedQuantity,
        deliveredQuantity: item.deliveredQuantity,
        unitPrice: item.unitPrice ?? orderedItem?.unitPrice ?? 0
      };
    });
  }

  private async calculateSaleItems(items: OrderItemDto[], tenantId: string, customerId: string, priceListId: string | null) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, tenantId, active: true } });
    if (products.length !== productIds.length) throw new ForbiddenException('One or more products do not belong to this tenant');

    const [customerPrices, priceListItems] = await Promise.all([
      this.prisma.customerProductPrice.findMany({ where: { tenantId, customerId, productId: { in: productIds } } }),
      this.prisma.priceListItem.findMany({
        where: priceListId
          ? {
              tenantId,
              productId: { in: productIds },
              priceListId
            }
          : { tenantId, id: { in: [] } },
        include: { priceList: true }
      })
    ]);

    const productMap = new Map(products.map((product) => [product.id, product]));
    const customerPriceMap = new Map(customerPrices.map((price) => [price.productId, Number(price.price)]));
    const assignedPriceMap = new Map(priceListItems.filter((item) => item.priceListId === priceListId).map((item) => [item.productId, Number(item.price)]));

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

  private async syncOrderWithDeliveredItems(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderId: string,
    items: Array<{ productId: string; deliveredQuantity: number; unitPrice: number }>
  ): Promise<void> {
    const orderItems = items
      .filter((item) => item.deliveredQuantity > 0)
      .map((item) => {
        const lineSubtotal = this.money(item.deliveredQuantity * item.unitPrice);
        return {
          tenantId,
          productId: item.productId,
          quantity: item.deliveredQuantity,
          unitPrice: this.money(item.unitPrice),
          discount: 0,
          lineSubtotal,
          lineTotal: lineSubtotal
        };
      });
    if (!orderItems.length) throw new BadRequestException('Delivered order requires at least one item');

    const total = this.money(orderItems.reduce((sum, item) => sum + item.lineTotal, 0));
    await tx.orderItem.deleteMany({ where: { tenantId, orderId } });
    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal: total,
        discountTotal: 0,
        total,
        items: { create: orderItems }
      }
    });
  }

  private async applyVehicleDelivery(tx: Prisma.TransactionClient, tenantId: string, vehicleId: string, productId: string, quantity: number, userId: string, reference: string): Promise<void> {
    if (quantity <= 0) return;
    const current = await tx.inventory.findFirst({ where: { tenantId, productId, vehicleId, warehouseId: null } });
    if (current) {
      await tx.inventory.update({ where: { id: current.id }, data: { quantity: { decrement: quantity } } });
    } else {
      await tx.inventory.create({ data: { tenantId, productId, vehicleId, warehouseId: null, locationType: InventoryLocation.VEHICLE, quantity: -quantity } });
    }
    await tx.inventoryMovement.create({ data: { tenantId, productId, type: 'DELIVERY', quantity, vehicleId, userId, reference, reason: 'Entrega movil' } });
  }

  private async saveEvidence(tx: Prisma.TransactionClient, tenantId: string, routeOrderId: string, type: DeliveryEvidenceType, base64?: string): Promise<void> {
    if (!base64) return;
    const parsed = this.parseBase64(base64, type === 'SIGNATURE' ? 'signature.png' : 'delivery-photo.jpg');
    const stored = await this.storage.save({ tenantId, entityType: 'delivery-stop', entityId: routeOrderId, ...parsed });
    await tx.deliveryEvidence.create({ data: { tenantId, routeOrderId, type, ...stored } });
  }

  private parseBase64(input: string, fallbackName: string) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(input);
    const mimeType = match?.[1] ?? 'application/octet-stream';
    const payload = match?.[2] ?? input;
    return { originalName: fallbackName, mimeType, buffer: Buffer.from(payload, 'base64') };
  }

  private async tenantSettings(tenantId: string) {
    const settings = await this.prisma.tenantSetting.findUnique({ where: { tenantId } });
    if (!settings) throw new NotFoundException('Tenant settings not found');
    return settings;
  }

  private distanceToCustomer(routeOrder: RouteOrderForStop, latitude?: number, longitude?: number): number | undefined {
    const targetLat = routeOrder.order.deliveryAddress?.latitude;
    const targetLng = routeOrder.order.deliveryAddress?.longitude;
    if (latitude === undefined || longitude === undefined || targetLat === null || targetLat === undefined || targetLng === null || targetLng === undefined) return undefined;
    return this.haversine(latitude, longitude, Number(targetLat), Number(targetLng));
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const radius = 6371000;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
  }

  private routeInclude() {
    return {
      vehicle: true,
      warehouse: true,
      orders: {
        orderBy: { sequence: 'asc' as const },
        include: {
          order: { include: { customer: true, deliveryAddress: true, items: { include: { product: true } } } },
          deliveredItems: { include: { product: true } },
          evidences: true
        }
      }
    };
  }

  private stopInclude() {
    return { order: { include: { customer: true, items: { include: { product: true } } } }, deliveredItems: { include: { product: true } }, evidences: true };
  }

  private jsonResult(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private money(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
