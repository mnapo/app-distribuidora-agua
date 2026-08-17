import { ConflictException, ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async findAll(actor: AuthenticatedUser) {
    const tenantId = this.requireTenant(actor);
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        isPlatformAdmin: true,
        createdAt: true,
        userRoles: {
          include: { role: true }
        }
      }
    });
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser) {
    const tenantId = this.requireTenant(actor);
    const email = dto.email.toLowerCase().trim();
    await this.assertRolesBelongToTenant(dto.roleIds ?? [], tenantId);
    await this.assertEmailAvailable(email);

    const passwordHash = await this.auth.hashPassword(dto.password);
    const user = await this.createUser({
      tenantId,
      email,
      passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      roleIds: dto.roleIds ?? []
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'users.create',
      entity: 'User',
      entityId: user.id,
      newValues: {
        email: user.email,
        roleIds: dto.roleIds ?? []
      }
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    const tenantId = this.requireTenant(actor);
    const current = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: { userRoles: true }
    });

    if (!current) {
      throw new NotFoundException('User not found');
    }

    await this.assertRolesBelongToTenant(dto.roleIds ?? [], tenantId);

    const user = await this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
      }

      return tx.user.update({
        where: { id },
        data: {
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          status: dto.status,
          userRoles: dto.roleIds
            ? {
                create: dto.roleIds.map((roleId) => ({ roleId }))
              }
            : undefined
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          isPlatformAdmin: true,
          userRoles: { include: { role: true } }
        }
      });
    });

    await this.audit.log({
      tenantId,
      userId: actor.id,
      action: 'users.update',
      entity: 'User',
      entityId: id,
      oldValues: {
        firstName: current.firstName,
        lastName: current.lastName,
        status: current.status,
        roleIds: current.userRoles.map((role) => role.roleId)
      },
      newValues: {
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        roleIds: user.userRoles.map((role) => role.roleId)
      }
    });

    return user;
  }

  private async assertRolesBelongToTenant(roleIds: string[], tenantId: string): Promise<void> {
    if (!roleIds.length) {
      return;
    }

    const count = await this.prisma.role.count({
      where: {
        id: { in: roleIds },
        tenantId
      }
    });

    if (count !== new Set(roleIds).size) {
      throw new ForbiddenException('One or more roles do not belong to this tenant');
    }
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

  private async createUser(input: {
    tenantId: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    roleIds: string[];
  }) {
    try {
      return await this.prisma.user.create({
        data: {
          tenantId: input.tenantId,
          email: input.email,
          passwordHash: input.passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          userRoles: {
            create: input.roleIds.map((roleId) => ({ roleId }))
          }
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          isPlatformAdmin: true,
          userRoles: { include: { role: true } }
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User email already exists');
      }
      throw error;
    }
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId || user.isPlatformAdmin) {
      throw new ForbiddenException('Tenant user required');
    }
    return user.tenantId;
  }
}
