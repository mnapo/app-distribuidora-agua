import { Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateBranchDto } from './dto/create-branch.dto.js';
import { UpdateBranchDto } from './dto/update-branch.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class BranchesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async findAll(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.BranchWhereInput = {
      tenantId,
      active: query.active,
      name: query.search ? { contains: query.search } : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.branch.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(query) }),
      this.prisma.branch.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async create(dto: CreateBranchDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const branch = await this.prisma.branch.create({
      data: { ...this.clean(dto), tenantId }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'branches.create', entity: 'Branch', entityId: branch.id, newValues: { name: branch.name } });
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.branch.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Branch not found');
    const branch = await this.prisma.branch.update({ where: { id }, data: this.clean(dto) });
    await this.audit.log({ tenantId, userId: user.id, action: 'branches.update', entity: 'Branch', entityId: id, oldValues: { name: current.name, active: current.active }, newValues: { name: branch.name, active: branch.active } });
    return branch;
  }

  private clean<T extends CreateBranchDto | UpdateBranchDto>(dto: T): T {
    return {
      ...dto,
      name: dto.name?.trim(),
      code: dto.code?.trim() || undefined,
      address: dto.address?.trim() || undefined,
      phone: dto.phone?.trim() || undefined
    };
  }
}
