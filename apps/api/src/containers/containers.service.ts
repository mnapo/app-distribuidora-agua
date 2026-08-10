import { ForbiddenException, Injectable, Inject} from '@nestjs/common';
import { ContainerMovementType, Prisma } from '@prisma/client';
import { CreateContainerMovementDto } from './dto/create-container-movement.dto.js';
import { CreateContainerTypeDto } from './dto/create-container-type.dto.js';
import { ContainersQueryDto } from './dto/containers-query.dto.js';
import { pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ContainersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findTypes(query: ContainersQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.ContainerTypeWhereInput = { tenantId, active: query.active, name: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.containerType.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(query) }),
      this.prisma.containerType.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createType(dto: CreateContainerTypeDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const type = await this.prisma.containerType.create({
      data: { tenantId, name: dto.name.trim(), code: dto.code?.trim(), capacity: dto.capacity, active: dto.active }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'containers.types.create', entity: 'ContainerType', entityId: type.id, newValues: { name: type.name } });
    return type;
  }

  async createMovement(dto: CreateContainerMovementDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertCustomer(dto.customerId, tenantId);
    await this.assertContainerType(dto.containerTypeId, tenantId);
    await this.assertRouteOrder(dto.routeOrderId, dto.customerId, tenantId);
    const delta = this.delta(dto.type, dto.quantity);

    const movement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.containerMovement.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          containerTypeId: dto.containerTypeId,
          routeOrderId: dto.routeOrderId,
          type: dto.type,
          quantity: dto.quantity,
          reference: dto.reference?.trim(),
          notes: dto.notes?.trim()
        }
      });
      await tx.customerContainerBalance.upsert({
        where: { customerId_containerTypeId: { customerId: dto.customerId, containerTypeId: dto.containerTypeId } },
        update: { balance: { increment: delta } },
        create: { tenantId, customerId: dto.customerId, containerTypeId: dto.containerTypeId, balance: delta }
      });
      return created;
    });

    await this.audit.log({ tenantId, userId: user.id, action: 'containers.movements.create', entity: 'ContainerMovement', entityId: movement.id, newValues: { type: dto.type, quantity: dto.quantity } });
    return movement;
  }

  async findMovements(query: ContainersQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.ContainerMovementWhereInput = { tenantId, customerId: query.customerId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.containerMovement.findMany({ where, include: { customer: true, containerType: true, routeOrder: true }, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.containerMovement.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async balances(query: ContainersQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.CustomerContainerBalanceWhereInput = { tenantId, customerId: query.customerId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customerContainerBalance.findMany({ where, include: { customer: true, containerType: true }, orderBy: { updatedAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.customerContainerBalance.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  private delta(type: ContainerMovementType, quantity: number): number {
    if (type === 'DELIVERED') return quantity;
    if (type === 'RETURNED') return -quantity;
    return quantity;
  }

  private async assertCustomer(customerId: string, tenantId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new ForbiddenException('Customer does not belong to this tenant');
  }

  private async assertContainerType(containerTypeId: string, tenantId: string): Promise<void> {
    const type = await this.prisma.containerType.findFirst({ where: { id: containerTypeId, tenantId, active: true } });
    if (!type) throw new ForbiddenException('Container type does not belong to this tenant');
  }

  private async assertRouteOrder(routeOrderId: string | undefined, customerId: string, tenantId: string): Promise<void> {
    if (!routeOrderId) return;
    const routeOrder = await this.prisma.deliveryRouteOrder.findFirst({ where: { id: routeOrderId, tenantId, order: { customerId } } });
    if (!routeOrder) throw new ForbiddenException('Route order does not belong to this customer');
  }
}
