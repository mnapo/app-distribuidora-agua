import { ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateDriverDto } from './dto/create-driver.dto.js';
import { UpdateDriverDto } from './dto/update-driver.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class DriversService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.DriverWhereInput = {
      tenantId,
      status: query.active === undefined ? undefined : query.active ? 'ACTIVE' : { not: 'ACTIVE' },
      user: query.search ? { OR: [{ firstName: { contains: query.search } }, { lastName: { contains: query.search } }, { email: { contains: query.search } }] } : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.driver.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async create(dto: CreateDriverDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertUser(dto.userId, tenantId);
    const driver = await this.prisma.driver.create({ data: { ...this.cleanCreate(dto), tenantId } });
    await this.audit.log({ tenantId, userId: user.id, action: 'drivers.create', entity: 'Driver', entityId: driver.id, newValues: { driverUserId: driver.userId } });
    return driver;
  }

  async update(id: string, dto: UpdateDriverDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.driver.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Driver not found');
    if (dto.userId) await this.assertUser(dto.userId, tenantId);
    const driver = await this.prisma.driver.update({ where: { id }, data: this.cleanUpdate(dto) });
    await this.audit.log({ tenantId, userId: user.id, action: 'drivers.update', entity: 'Driver', entityId: id, oldValues: { status: current.status }, newValues: { status: driver.status } });
    return driver;
  }

  private async assertUser(userId: string, tenantId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new ForbiddenException('User does not belong to this tenant');
  }

  private cleanCreate(dto: CreateDriverDto): Omit<Prisma.DriverUncheckedCreateInput, 'tenantId'> {
    return {
      ...dto,
      licenseNumber: dto.licenseNumber?.trim(),
      licenseCategory: dto.licenseCategory?.trim()
    };
  }

  private cleanUpdate(dto: UpdateDriverDto): Prisma.DriverUncheckedUpdateInput {
    return {
      ...dto,
      licenseNumber: dto.licenseNumber?.trim(),
      licenseCategory: dto.licenseCategory?.trim()
    };
  }
}
