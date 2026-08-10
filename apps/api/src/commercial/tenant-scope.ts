import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../common/authenticated-user.js';

export function requireTenant(user: AuthenticatedUser): string {
  if (!user.tenantId || user.isPlatformAdmin) {
    throw new ForbiddenException('Tenant user required');
  }
  return user.tenantId;
}
