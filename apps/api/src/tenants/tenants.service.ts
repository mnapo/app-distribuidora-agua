import { ConflictException, ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
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
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { name: 'asc' },
      include: {
        settings: true,
        users: {
          where: {
            userRoles: {
              some: {
                role: {
                  name: 'Administrador'
                }
              }
            }
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true
          }
        }
      }
    });

    return tenants.map(({ users, ...tenant }) => ({
      ...tenant,
      adminUser: users[0] ?? null
    }));
  }

  async create(dto: CreateTenantDto, actor: AuthenticatedUser) {
    this.assertPlatformAdmin(actor);
    const adminEmail = dto.adminEmail.toLowerCase().trim();
    await this.assertEmailAvailable(adminEmail);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const nextTenant = await tx.tenant.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim(),
          settings: {
            create: {}
          }
        },
        include: { settings: true }
      });

      const adminRole = await tx.role.create({
        data: {
          tenantId: nextTenant.id,
          name: 'Administrador',
          description: 'Rol administrador inicial',
          isSystem: true
        }
      });

      const permissions = await tx.permission.findMany({
        where: {
          code: {
            not: {
              startsWith: 'platform.'
            }
          }
        },
        select: { id: true }
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: adminRole.id,
            permissionId: permission.id
          })),
          skipDuplicates: true
        });
      }

      const passwordHash = await hash(dto.adminPassword, 12);
      await tx.user.create({
        data: {
          tenantId: nextTenant.id,
          email: adminEmail,
          passwordHash,
          firstName: dto.adminFirstName.trim(),
          lastName: dto.adminLastName.trim(),
          userRoles: {
            create: {
              roleId: adminRole.id
            }
          }
        }
      });

      return nextTenant;
    }).catch((error: unknown) => this.handleUniqueEmailError(error));

    await this.audit.log({
      tenantId: tenant.id,
      userId: actor.id,
      action: 'tenants.create',
      entity: 'Tenant',
      entityId: tenant.id,
      newValues: { name: tenant.name, slug: tenant.slug, status: tenant.status, adminEmail }
    });

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto, actor: AuthenticatedUser) {
    this.assertPlatformAdmin(actor);

    const current = await this.prisma.tenant.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Tenant not found');
    }

    const tenant = await this.prisma.$transaction(async (tx) => {
      const updatedTenant = await tx.tenant.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug: dto.slug?.trim(),
          status: dto.status
        },
        include: { settings: true }
      });

      if (this.hasAdminUpdate(dto)) {
        const adminEmail = dto.adminEmail?.toLowerCase().trim();
        const adminRole = await tx.role.findFirst({
          where: {
            tenantId: id,
            name: 'Administrador'
          }
        }) ?? await tx.role.create({
          data: {
            tenantId: id,
            name: 'Administrador',
            description: 'Rol administrador inicial',
            isSystem: true
          }
        });

        await this.ensureRolePermissions(tx, adminRole.id);

        const adminUser = await tx.user.findFirst({
          where: {
            tenantId: id,
            userRoles: {
              some: {
                roleId: adminRole.id
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        });

        if (adminUser) {
          if (adminEmail) {
            await this.assertEmailAvailable(adminEmail, adminUser.id);
          }

          await tx.user.update({
            where: { id: adminUser.id },
            data: {
              email: adminEmail,
              firstName: dto.adminFirstName?.trim(),
              lastName: dto.adminLastName?.trim(),
              passwordHash: dto.adminPassword ? await hash(dto.adminPassword, 12) : undefined
            }
          });
        } else {
          const email = this.requiredAdminField(adminEmail, 'adminEmail');
          await this.assertEmailAvailable(email);

          await tx.user.create({
            data: {
              tenantId: id,
              email,
              passwordHash: await hash(this.requiredAdminField(dto.adminPassword, 'adminPassword'), 12),
              firstName: this.requiredAdminField(dto.adminFirstName, 'adminFirstName').trim(),
              lastName: this.requiredAdminField(dto.adminLastName, 'adminLastName').trim(),
              userRoles: {
                create: {
                  roleId: adminRole.id
                }
              }
            }
          });
        }
      }

      return updatedTenant;
    }).catch((error: unknown) => this.handleUniqueEmailError(error));

    await this.audit.log({
      tenantId: tenant.id,
      userId: actor.id,
      action: 'tenants.update',
      entity: 'Tenant',
      entityId: tenant.id,
      oldValues: { name: current.name, slug: current.slug, status: current.status },
      newValues: {
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        adminEmail: dto.adminEmail?.toLowerCase().trim()
      }
    });

    return tenant;
  }

  private hasAdminUpdate(dto: UpdateTenantDto): boolean {
    return Boolean(dto.adminEmail || dto.adminPassword || dto.adminFirstName || dto.adminLastName);
  }

  private async ensureRolePermissions(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    roleId: string
  ): Promise<void> {
    const permissions = await tx.permission.findMany({
      where: {
        code: {
          not: {
            startsWith: 'platform.'
          }
        }
      },
      select: { id: true }
    });

    if (permissions.length === 0) return;

    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId,
        permissionId: permission.id
      })),
      skipDuplicates: true
    });
  }

  private requiredAdminField(value: string | undefined, field: string): string {
    if (!value) {
      throw new ForbiddenException(`${field} is required to create administrator user`);
    }
    return value;
  }

  private async assertEmailAvailable(email: string, excludeUserId?: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('User email already exists');
    }
  }

  private handleUniqueEmailError(error: unknown): never {
    if (this.isUserEmailUniqueError(error)) {
      throw new ConflictException('User email already exists');
    }
    throw error;
  }

  private isUserEmailUniqueError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    return Array.isArray(target)
      ? target.includes('email')
      : typeof target === 'string' && (target.includes('users_email_key') || target.includes('email'));
  }

  private assertPlatformAdmin(user: AuthenticatedUser): void {
    if (!user.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin required');
    }
  }
}
