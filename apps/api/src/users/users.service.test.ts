import test from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['users.view', 'users.create', 'users.update']
};

test('UsersService.findAll scopes every query to the authenticated tenant', async () => {
  let receivedWhere: unknown;
  const service = new UsersService(
    {
      user: {
        findMany: (args: { where: unknown }) => {
          receivedWhere = args.where;
          return [];
        }
      }
    } as never,
    {} as never,
    {} as never
  );

  await service.findAll(tenantUser);

  assert.deepEqual(receivedWhere, { tenantId: 'tenant-a' });
});

test('UsersService.create rejects roles that do not belong to the authenticated tenant', async () => {
  const service = new UsersService(
    {
      role: {
        count: (args: { where: unknown }) => {
          assert.deepEqual(args.where, {
            id: { in: ['role-from-tenant-b'] },
            tenantId: 'tenant-a'
          });
          return 0;
        }
      }
    } as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.create(
        {
          email: 'user@tenant-a.local',
          password: 'Admin123!',
          firstName: 'Tenant',
          lastName: 'User',
          roleIds: ['role-from-tenant-b']
        },
        tenantUser
      ),
    ForbiddenException
  );
});

test('UsersService.create rejects duplicated user email globally', async () => {
  const service = new UsersService(
    {
      user: {
        findUnique: (args: { where: unknown }) => {
          assert.deepEqual(args.where, { email: 'shared@tenant.local' });
          return { id: 'existing-user' };
        }
      }
    } as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.create(
        {
          email: ' Shared@Tenant.Local ',
          password: 'Admin123!',
          firstName: 'Tenant',
          lastName: 'User'
        },
        tenantUser
      ),
    ConflictException
  );
});

test('UsersService.findAll rejects platform admin for tenant-scoped user administration', async () => {
  const service = new UsersService({} as never, {} as never, {} as never);

  await assert.rejects(
    () =>
      service.findAll({
        ...tenantUser,
        tenantId: null,
        isPlatformAdmin: true
      }),
    ForbiddenException
  );
});
