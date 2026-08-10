import { Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class VehiclesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.VehicleWhereInput = {
      tenantId,
      status: query.active === undefined ? undefined : query.active ? 'ACTIVE' : { not: 'ACTIVE' },
      OR: query.search ? [{ plate: { contains: query.search } }, { brand: { contains: query.search } }, { model: { contains: query.search } }] : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({ where, orderBy: { plate: 'asc' }, ...pageArgs(query) }),
      this.prisma.vehicle.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async create(dto: CreateVehicleDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const vehicle = await this.prisma.vehicle.create({ data: { ...this.cleanCreate(dto), tenantId } });
    await this.audit.log({ tenantId, userId: user.id, action: 'vehicles.create', entity: 'Vehicle', entityId: vehicle.id, newValues: { plate: vehicle.plate } });
    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.vehicle.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Vehicle not found');
    const vehicle = await this.prisma.vehicle.update({ where: { id }, data: this.cleanUpdate(dto) });
    await this.audit.log({ tenantId, userId: user.id, action: 'vehicles.update', entity: 'Vehicle', entityId: id, oldValues: { plate: current.plate, status: current.status }, newValues: { plate: vehicle.plate, status: vehicle.status } });
    return vehicle;
  }

  private cleanCreate(dto: CreateVehicleDto): Omit<Prisma.VehicleUncheckedCreateInput, 'tenantId'> {
    return {
      ...dto,
      plate: dto.plate?.trim().toUpperCase(),
      brand: dto.brand?.trim(),
      model: dto.model?.trim()
    };
  }

  private cleanUpdate(dto: UpdateVehicleDto): Prisma.VehicleUncheckedUpdateInput {
    return {
      ...dto,
      plate: dto.plate?.trim().toUpperCase(),
      brand: dto.brand?.trim(),
      model: dto.model?.trim()
    };
  }
}
