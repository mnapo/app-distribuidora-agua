import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { LoginDto } from './dto/login.dto.js';
import { AccessTokenPayload, AuthResponse } from './auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';

type RequestMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: SignOptions['expiresIn'];
  private readonly refreshTokenDays: number;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(AuditService)
    private readonly audit: AuditService
  ) {
    this.accessSecret = this.config.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret-change-me');
    this.accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as SignOptions['expiresIn'];
    this.refreshTokenDays = Number(this.config.get<string>('REFRESH_TOKEN_DAYS', '7'));
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.findLoginUser(email);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      newValues: { email: user.email },
      ip: meta.ip,
      userAgent: meta.userAgent
    });

    return this.createAuthResponse(user.id, meta);
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const replacement = this.generateRefreshToken();
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedBy: this.hashToken(replacement)
      }
    });

    return this.createAuthResponse(storedToken.userId, meta, replacement);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return { success: true };
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = jwt.verify(token, this.accessSecret) as AccessTokenPayload;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          tenant: true,
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Invalid token');
      }

      if (user.tenant && user.tenant.status !== 'ACTIVE') {
        throw new UnauthorizedException('Tenant is not active');
      }

      const permissions = user.userRoles.flatMap((userRole) =>
        userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code)
      );

      return {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        isPlatformAdmin: user.isPlatformAdmin,
        permissions: [...new Set(permissions)]
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async hashPassword(password: string): Promise<string> {
    return hash(password, 12);
  }

  private async findLoginUser(email: string) {
    return this.prisma.user.findUnique({
      where: { email }
    });
  }

  private async createAuthResponse(
    userId: string,
    meta: RequestMeta,
    refreshToken = this.generateRefreshToken()
  ): Promise<AuthResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const permissions = [
      ...new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code)
        )
      )
    ];

    const accessToken = jwt.sign(
      {
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        isPlatformAdmin: user.isPlatformAdmin
      },
      this.accessSecret,
      { expiresIn: this.accessExpiresIn }
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTokenDays * 24 * 60 * 60 * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent
      }
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name ?? null,
        tenantSlug: user.tenant?.slug ?? null,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isPlatformAdmin: user.isPlatformAdmin,
        permissions
      }
    };
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
