import test from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['roles.view', 'roles.update']
};

test('RolesService.update only loads roles from the authenticated tenant', async () => {
  let receivedWhere: unknown;
  const service = new RolesService(
    {
      role: {
        findFirst: (args: { where: unknown }) => {
          receivedWhere = args.where;
          return null;
        }
      }
    } as never,
    {} as never
  );

  await assert.rejects(
    () => service.update('role-from-tenant-b', { name: 'Supervisor' }, tenantUser),
    NotFoundException
  );

  assert.deepEqual(receivedWhere, {
    id: 'role-from-tenant-b',
    tenantId: 'tenant-a'
  });
});
