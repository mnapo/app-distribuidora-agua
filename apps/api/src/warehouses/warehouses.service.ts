import { ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class WarehousesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async findAll(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.WarehouseWhereInput = {
      tenantId,
      active: query.active,
      name: query.search ? { contains: query.search } : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.warehouse.findMany({ where, include: { branch: true }, orderBy: { name: 'asc' }, ...pageArgs(query) }),
      this.prisma.warehouse.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async create(dto: CreateWarehouseDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertBranch(dto.branchId, tenantId);
    const warehouse = await this.prisma.warehouse.create({ data: { ...this.clean(dto), tenantId } });
    await this.audit.log({ tenantId, userId: user.id, action: 'warehouses.create', entity: 'Warehouse', entityId: warehouse.id, newValues: { name: warehouse.name } });
    return warehouse;
  }

  async update(id: string, dto: UpdateWarehouseDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.warehouse.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Warehouse not found');
    await this.assertBranch(dto.branchId, tenantId);
    const warehouse = await this.prisma.warehouse.update({ where: { id }, data: this.clean(dto) });
    await this.audit.log({ tenantId, userId: user.id, action: 'warehouses.update', entity: 'Warehouse', entityId: id, oldValues: { name: current.name, active: current.active }, newValues: { name: warehouse.name, active: warehouse.active } });
    return warehouse;
  }

  private async assertBranch(branchId: string | undefined, tenantId: string): Promise<void> {
    if (!branchId) return;
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new ForbiddenException('Branch does not belong to this tenant');
  }

  private clean<T extends CreateWarehouseDto | UpdateWarehouseDto>(dto: T): T {
    return {
      ...dto,
      name: dto.name?.trim(),
      code: dto.code?.trim() || undefined,
      address: dto.address?.trim() || undefined
    };
  }
}
