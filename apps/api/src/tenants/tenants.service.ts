import { ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class TenantsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { name: 'asc' },
      include: { settings: true }
    });
  }

  async create(dto: CreateTenantDto, actor: AuthenticatedUser) {
    this.assertPlatformAdmin(actor);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.trim(),
        settings: {
          create: {}
        }
      },
      include: { settings: true }
    });

    await this.audit.log({
      tenantId: tenant.id,
      userId: actor.id,
      action: 'tenants.create',
      entity: 'Tenant',
      entityId: tenant.id,
      newValues: { name: tenant.name, slug: tenant.slug, status: tenant.status }
    });

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto, actor: AuthenticatedUser) {
    this.assertPlatformAdmin(actor);

    const current = await this.prisma.tenant.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Tenant not found');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        status: dto.status
      },
      include: { settings: true }
    });

    await this.audit.log({
      tenantId: tenant.id,
      userId: actor.id,
      action: 'tenants.update',
      entity: 'Tenant',
      entityId: tenant.id,
      oldValues: { name: current.name, status: current.status },
      newValues: { name: tenant.name, status: tenant.status }
    });

    return tenant;
  }

  private assertPlatformAdmin(user: AuthenticatedUser): void {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin required');
    }
  }
}
