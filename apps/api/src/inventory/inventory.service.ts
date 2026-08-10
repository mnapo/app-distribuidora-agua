import { BadRequestException, ForbiddenException, Injectable, Inject} from '@nestjs/common';
import { InventoryLocation, InventoryMovementType, Prisma } from '@prisma/client';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto.js';
import { VehicleLoadDto } from './dto/vehicle-load.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

type Location = {
  warehouseId?: string;
  vehicleId?: string;
};

@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.InventoryWhereInput = {
      tenantId,
      product: query.search ? { OR: [{ name: { contains: query.search } }, { sku: { contains: query.search } }] } : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({ where, include: { product: true, warehouse: true, vehicle: true }, orderBy: { updatedAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.inventory.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async findMovements(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.InventoryMovementWhereInput = {
      tenantId,
      product: query.search ? { OR: [{ name: { contains: query.search } }, { sku: { contains: query.search } }] } : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({ where, include: { product: true, fromWarehouse: true, toWarehouse: true, vehicle: true, user: true }, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.inventoryMovement.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async loadVehicle(dto: VehicleLoadDto, user: AuthenticatedUser) {
    return this.createMovement(
      {
        productId: dto.productId,
        type: 'VEHICLE_LOAD',
        quantity: dto.quantity,
        fromWarehouseId: dto.warehouseId,
        vehicleId: dto.vehicleId
      },
      user
    );
  }

  async returnVehicleStock(dto: VehicleLoadDto, user: AuthenticatedUser) {
    return this.createMovement(
      {
        productId: dto.productId,
        type: 'VEHICLE_RETURN',
        quantity: dto.quantity,
        toWarehouseId: dto.warehouseId,
        vehicleId: dto.vehicleId
      },
      user
    );
  }

  async createMovement(dto: CreateInventoryMovementDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertProduct(dto.productId, tenantId);
    await this.assertWarehouse(dto.fromWarehouseId, tenantId);
    await this.assertWarehouse(dto.toWarehouseId, tenantId);
    await this.assertVehicle(dto.vehicleId, tenantId);
    this.validateMovementShape(dto);

    const movement = await this.prisma.$transaction(async (tx) => {
      await this.applyStockChange(tx, tenantId, dto.productId, this.sourceLocation(dto), -dto.quantity);
      await this.applyStockChange(tx, tenantId, dto.productId, this.destinationLocation(dto), dto.quantity);

      return tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          type: dto.type,
          quantity: dto.quantity,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          vehicleId: dto.vehicleId,
          userId: user.id,
          reason: dto.reason?.trim(),
          reference: dto.reference?.trim()
        }
      });
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'inventory.movements.create', entity: 'InventoryMovement', entityId: movement.id, newValues: { productId: dto.productId, type: dto.type, quantity: dto.quantity } });
    return movement;
  }

  private sourceLocation(dto: CreateInventoryMovementDto): Location | null {
    if (['SALE', 'DELIVERY', 'VEHICLE_LOAD'].includes(dto.type)) {
      return dto.type === 'VEHICLE_LOAD' ? { warehouseId: dto.fromWarehouseId } : { vehicleId: dto.vehicleId, warehouseId: dto.fromWarehouseId };
    }
    if (dto.type === 'TRANSFER') return { warehouseId: dto.fromWarehouseId };
    if (dto.type === 'VEHICLE_RETURN') return { vehicleId: dto.vehicleId };
    return null;
  }

  private destinationLocation(dto: CreateInventoryMovementDto): Location | null {
    if (['PURCHASE', 'RETURN', 'ADJUSTMENT'].includes(dto.type)) return { warehouseId: dto.toWarehouseId };
    if (dto.type === 'TRANSFER') return { warehouseId: dto.toWarehouseId };
    if (dto.type === 'VEHICLE_LOAD') return { vehicleId: dto.vehicleId };
    if (dto.type === 'VEHICLE_RETURN') return { warehouseId: dto.toWarehouseId };
    return null;
  }

  private async applyStockChange(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    location: Location | null,
    delta: number
  ): Promise<void> {
    if (!location || delta === 0) return;
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

  private validateMovementShape(dto: CreateInventoryMovementDto): void {
    const required: Record<InventoryMovementType, () => boolean> = {
      PURCHASE: () => Boolean(dto.toWarehouseId),
      SALE: () => Boolean(dto.fromWarehouseId || dto.vehicleId),
      DELIVERY: () => Boolean(dto.vehicleId || dto.fromWarehouseId),
      RETURN: () => Boolean(dto.toWarehouseId),
      TRANSFER: () => Boolean(dto.fromWarehouseId && dto.toWarehouseId),
      ADJUSTMENT: () => Boolean(dto.toWarehouseId),
      VEHICLE_LOAD: () => Boolean(dto.fromWarehouseId && dto.vehicleId),
      VEHICLE_RETURN: () => Boolean(dto.toWarehouseId && dto.vehicleId)
    };
    if (!required[dto.type]()) throw new BadRequestException('Invalid inventory movement locations');
  }

  private async assertProduct(productId: string, tenantId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new ForbiddenException('Product does not belong to this tenant');
  }

  private async assertWarehouse(warehouseId: string | undefined, tenantId: string): Promise<void> {
    if (!warehouseId) return;
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId } });
    if (!warehouse) throw new ForbiddenException('Warehouse does not belong to this tenant');
  }

  private async assertVehicle(vehicleId: string | undefined, tenantId: string): Promise<void> {
    if (!vehicleId) return;
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } });
    if (!vehicle) throw new ForbiddenException('Vehicle does not belong to this tenant');
  }
}
