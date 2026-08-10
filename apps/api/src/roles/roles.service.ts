import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class RolesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async findAll(user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    return this.prisma.role.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      include: {
        rolePermissions: {
          include: { permission: true }
        }
      }
    });
  }

  async create(dto: CreateRoleDto, actor: AuthenticatedUser) {
    const tenantId = this.requireTenant(actor);
    const permissions = await this.findPermissions(dto.permissionCodes);

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        rolePermissions: {
          create: permissions.map((permission) => ({
            permissionId: permission.id
          }))
        }
      },
      include: { rolePermissions: { include: { permission: true } } }
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'roles.create',
      entity: 'Role',
      entityId: role.id,
      newValues: {
        name: role.name,
        permissions: permissions.map((permission) => permission.code)
      }
    });

    return role;
  }

  async update(id: string, dto: UpdateRoleDto, actor: AuthenticatedUser) {
    const tenantId = this.requireTenant(actor);
    const current = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: { rolePermissions: { include: { permission: true } } }
    });

    if (!current) {
      throw new NotFoundException('Role not found');
    }

    const permissions = dto.permissionCodes ? await this.findPermissions(dto.permissionCodes) : null;

    const role = await this.prisma.$transaction(async (tx) => {
      if (permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
      }

      return tx.role.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
          rolePermissions: permissions
            ? {
                create: permissions.map((permission) => ({ permissionId: permission.id }))
              }
            : undefined
        },
        include: { rolePermissions: { include: { permission: true } } }
      });
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'roles.update',
      entity: 'Role',
      entityId: role.id,
      oldValues: {
        name: current.name,
        permissions: current.rolePermissions.map((rp) => rp.permission.code)
      },
      newValues: {
        name: role.name,
        permissions: role.rolePermissions.map((rp) => rp.permission.code)
      }
    });

    return role;
  }

  private async findPermissions(codes: string[]) {
    const uniqueCodes = [...new Set(codes)];
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: uniqueCodes } }
    });

    if (permissions.length !== uniqueCodes.length) {
      throw new BadRequestException('One or more permissions do not exist');
    }

    return permissions;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId || user.isPlatformAdmin) {
      throw new ForbiddenException('Tenant user required');
    }
    return user.tenantId;
  }
}
