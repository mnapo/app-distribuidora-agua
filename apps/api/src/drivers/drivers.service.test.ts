import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { DriversService } from './drivers.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['drivers.create']
};

test('DriversService.create rejects users from another tenant', async () => {
  const service = new DriversService(
    {
      user: {
        findFirst: (args: { where: unknown }) => {
          assert.deepEqual(args.where, { id: 'user-b', tenantId: 'tenant-a' });
          return null;
        }
      }
    } as never,
    {} as never
  );

  await assert.rejects(() => service.create({ userId: 'user-b' }, tenantUser), ForbiddenException);
});
