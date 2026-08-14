import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { DispenserStatus, Prisma } from '@prisma/client';
import { CompleteDispenserMaintenanceDto } from './dto/complete-dispenser-maintenance.dto.js';
import { CreateDispenserComodatoDto } from './dto/create-dispenser-comodato.dto.js';
import { CreateDispenserMaintenanceDto } from './dto/create-dispenser-maintenance.dto.js';
import { CreateDispenserModelDto } from './dto/create-dispenser-model.dto.js';
import { CreateDispenserDto } from './dto/create-dispenser.dto.js';
import { DispensersQueryDto } from './dto/dispensers-query.dto.js';
import { RetireDispenserComodatoDto } from './dto/retire-dispenser-comodato.dto.js';
import { UpdateDispenserDto } from './dto/update-dispenser.dto.js';
import { UpdateDispenserModelDto } from './dto/update-dispenser-model.dto.js';
import { pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DispensersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async models(query: DispensersQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.DispenserModelWhereInput = { tenantId, active: query.active, name: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.dispenserModel.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(query) }),
      this.prisma.dispenserModel.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createModel(dto: CreateDispenserModelDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const model = await this.prisma.dispenserModel.create({
      data: { tenantId, name: dto.name.trim(), code: dto.code?.trim(), capacity: dto.capacity, active: dto.active }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'dispensers.models.create', entity: 'DispenserModel', entityId: model.id, newValues: { name: model.name } });
    return model;
  }

  async updateModel(id: string, dto: UpdateDispenserModelDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.dispenserModel.findFirst({ where: { id, tenantId } });
    if (!current) throw new ForbiddenException('Dispenser model does not belong to this tenant');
    const model = await this.prisma.dispenserModel.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code?.trim(),
        capacity: dto.capacity,
        active: dto.active
      }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'dispensers.models.update', entity: 'DispenserModel', entityId: id, oldValues: { active: current.active }, newValues: { active: model.active, name: model.name } });
    return model;
  }

  async findAll(query: DispensersQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.DispenserWhereInput = {
      tenantId,
      status: this.statusFilter(query.status),
      currentCustomerId: query.customerId,
      OR: query.search
        ? [{ serialNumber: { contains: query.search } }, { model: { name: { contains: query.search } } }]
        : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.dispenser.findMany({ where, include: { model: true, currentCustomer: true }, orderBy: { serialNumber: 'asc' }, ...pageArgs(query) }),
      this.prisma.dispenser.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async create(dto: CreateDispenserDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertModel(dto.modelId, tenantId);
    const dispenser = await this.prisma.dispenser.create({
      data: {
        tenantId,
        modelId: dto.modelId,
        serialNumber: dto.serialNumber.trim(),
        acquiredAt: dto.acquiredAt ? new Date(dto.acquiredAt) : undefined,
        notes: dto.notes?.trim()
      },
      include: { model: true }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'dispensers.create', entity: 'Dispenser', entityId: dispenser.id, newValues: { serialNumber: dispenser.serialNumber } });
    return dispenser;
  }

  async update(id: string, dto: UpdateDispenserDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.dispenser.findFirst({ where: { id, tenantId }, include: { comodatos: true } });
    if (!current) throw new ForbiddenException('Dispenser does not belong to this tenant');
    if (dto.modelId) await this.assertModel(dto.modelId, tenantId);
    if (dto.status === 'RETIRED' && current.comodatos.some((comodato) => comodato.status === 'ACTIVE')) {
      throw new BadRequestException('Dispenser with active comodato cannot be retired');
    }
    const dispenser = await this.prisma.dispenser.update({
      where: { id },
      data: {
        modelId: dto.modelId,
        serialNumber: dto.serialNumber?.trim(),
        acquiredAt: dto.acquiredAt ? new Date(dto.acquiredAt) : undefined,
        notes: dto.notes?.trim(),
        status: dto.status
      },
      include: { model: true, currentCustomer: true }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'dispensers.update', entity: 'Dispenser', entityId: id, oldValues: { status: current.status }, newValues: { status: dispenser.status, serialNumber: dispenser.serialNumber } });
    return dispenser;
  }

  async comodatos(query: DispensersQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.DispenserComodatoWhereInput = { tenantId, customerId: query.customerId, status: this.comodatoStatusFilter(query.status) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.dispenserComodato.findMany({ where, include: { customer: true, dispenser: { include: { model: true } } }, orderBy: { deliveredAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.dispenserComodato.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createComodato(dto: CreateDispenserComodatoDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertCustomer(dto.customerId, tenantId);
    const dispenser = await this.prisma.dispenser.findFirst({ where: { id: dto.dispenserId, tenantId } });
    if (!dispenser) throw new ForbiddenException('Dispenser does not belong to this tenant');
    if (dispenser.status !== 'AVAILABLE') throw new BadRequestException('Dispenser is not available');
    const deliveredAt = dto.deliveredAt ? new Date(dto.deliveredAt) : new Date();

    const comodato = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispenserComodato.create({
        data: {
          tenantId,
          dispenserId: dto.dispenserId,
          customerId: dto.customerId,
          deliveredAt,
          depositAmount: dto.depositAmount ?? 0,
          notes: dto.notes?.trim()
        }
      });
      await tx.dispenser.update({ where: { id: dto.dispenserId }, data: { status: 'ON_LOAN', currentCustomerId: dto.customerId } });
      await tx.dispenserMovement.create({
        data: { tenantId, dispenserId: dto.dispenserId, customerId: dto.customerId, comodatoId: created.id, type: 'DELIVERED', movedAt: deliveredAt, notes: dto.notes?.trim() }
      });
      return created;
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'dispensers.comodatos.create', entity: 'DispenserComodato', entityId: comodato.id, newValues: { dispenserId: dto.dispenserId, customerId: dto.customerId } });
    return comodato;
  }

  async retireComodato(id: string, dto: RetireDispenserComodatoDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const comodato = await this.prisma.dispenserComodato.findFirst({ where: { id, tenantId }, include: { dispenser: true } });
    if (!comodato) throw new NotFoundException('Comodato not found');
    if (comodato.status !== 'ACTIVE') throw new BadRequestException('Comodato is not active');
    const returnedAt = dto.returnedAt ? new Date(dto.returnedAt) : new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.dispenserComodato.update({
        where: { id },
        data: { status: 'RETURNED', returnedAt, notes: dto.notes?.trim() ?? comodato.notes },
        include: { customer: true, dispenser: { include: { model: true } } }
      });
      await tx.dispenser.update({ where: { id: comodato.dispenserId }, data: { status: 'AVAILABLE', currentCustomerId: null } });
      await tx.dispenserMovement.create({
        data: { tenantId, dispenserId: comodato.dispenserId, customerId: comodato.customerId, comodatoId: id, type: 'RETIRED', movedAt: returnedAt, notes: dto.notes?.trim() }
      });
      return result;
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'dispensers.comodatos.retire', entity: 'DispenserComodato', entityId: id, newValues: { returnedAt } });
    return updated;
  }

  async createMaintenance(dto: CreateDispenserMaintenanceDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const dispenser = await this.assertDispenser(dto.dispenserId, tenantId);
    const maintenance = await this.prisma.dispenserMaintenance.create({
      data: {
        tenantId,
        dispenserId: dto.dispenserId,
        customerId: dispenser.currentCustomerId,
        type: dto.type,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        cost: dto.cost ?? 0,
        notes: dto.notes?.trim()
      }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'dispensers.maintenance.create', entity: 'DispenserMaintenance', entityId: maintenance.id, newValues: { dispenserId: dto.dispenserId, type: dto.type } });
    return maintenance;
  }

  async completeMaintenance(id: string, dto: CompleteDispenserMaintenanceDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const maintenance = await this.prisma.dispenserMaintenance.findFirst({ where: { id, tenantId } });
    if (!maintenance) throw new NotFoundException('Maintenance not found');
    const completed = await this.prisma.dispenserMaintenance.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: dto.completedAt ? new Date(dto.completedAt) : new Date(),
        cost: dto.cost ?? maintenance.cost,
        result: dto.result?.trim()
      }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'dispensers.maintenance.complete', entity: 'DispenserMaintenance', entityId: id, newValues: { result: completed.result } });
    return completed;
  }

  async history(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const dispenser = await this.prisma.dispenser.findFirst({
      where: { id, tenantId },
      include: { model: true, currentCustomer: true }
    });
    if (!dispenser) throw new NotFoundException('Dispenser not found');
    const [comodatos, movements, maintenances] = await this.prisma.$transaction([
      this.prisma.dispenserComodato.findMany({ where: { tenantId, dispenserId: id }, include: { customer: true }, orderBy: { deliveredAt: 'desc' } }),
      this.prisma.dispenserMovement.findMany({ where: { tenantId, dispenserId: id }, include: { customer: true }, orderBy: { movedAt: 'desc' } }),
      this.prisma.dispenserMaintenance.findMany({ where: { tenantId, dispenserId: id }, include: { customer: true }, orderBy: { scheduledAt: 'desc' } })
    ]);
    return { dispenser, comodatos, movements, maintenances };
  }

  private statusFilter(status: string | undefined): DispenserStatus | undefined {
    if (!status) return undefined;
    return Object.values(DispenserStatus).includes(status as DispenserStatus) ? (status as DispenserStatus) : undefined;
  }

  private comodatoStatusFilter(status: string | undefined) {
    if (!status) return undefined;
    return status === 'ACTIVE' || status === 'RETURNED' || status === 'CANCELLED' ? status : undefined;
  }

  private async assertModel(modelId: string, tenantId: string): Promise<void> {
    const model = await this.prisma.dispenserModel.findFirst({ where: { id: modelId, tenantId, active: true } });
    if (!model) throw new ForbiddenException('Dispenser model does not belong to this tenant');
  }

  private async assertCustomer(customerId: string, tenantId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new ForbiddenException('Customer does not belong to this tenant');
  }

  private async assertDispenser(dispenserId: string, tenantId: string) {
    const dispenser = await this.prisma.dispenser.findFirst({ where: { id: dispenserId, tenantId } });
    if (!dispenser) throw new ForbiddenException('Dispenser does not belong to this tenant');
    return dispenser;
  }
}
