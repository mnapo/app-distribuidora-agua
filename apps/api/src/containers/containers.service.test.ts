import test from 'node:test';
import assert from 'node:assert/strict';
import { ContainersService } from './containers.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['containers.create_movement']
};

test('ContainersService.createMovement increments balance for delivered containers', async () => {
  const calls: string[] = [];
  const service = new ContainersService(
    {
      customer: { findFirst: () => ({ id: 'customer-a' }) },
      containerType: { findFirst: () => ({ id: 'container-a' }) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          containerMovement: {
            create: () => {
              calls.push('movement.create');
              return { id: 'movement-a' };
            }
          },
          customerContainerBalance: {
            upsert: (args: { update: { balance: { increment: number } }; create: { balance: number } }) => {
              calls.push('balance.upsert');
              assert.equal(args.update.balance.increment, 3);
              assert.equal(args.create.balance, 3);
            }
          }
        })
    } as never,
    { log: () => undefined } as never
  );

  await service.createMovement({ customerId: 'customer-a', containerTypeId: 'container-a', type: 'DELIVERED', quantity: 3 }, tenantUser);

  assert.deepEqual(calls, ['movement.create', 'balance.upsert']);
});

test('ContainersService.createMovement decrements balance for returned containers', async () => {
  const service = new ContainersService(
    {
      customer: { findFirst: () => ({ id: 'customer-a' }) },
      containerType: { findFirst: () => ({ id: 'container-a' }) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          containerMovement: { create: () => ({ id: 'movement-a' }) },
          customerContainerBalance: {
            findUnique: () => ({ balance: 3 }),
            upsert: (args: { update: { balance: { increment: number } }; create: { balance: number } }) => {
              assert.equal(args.update.balance.increment, -2);
              assert.equal(args.create.balance, -2);
            }
          }
        })
    } as never,
    { log: () => undefined } as never
  );

  await service.createMovement({ customerId: 'customer-a', containerTypeId: 'container-a', type: 'RETURNED', quantity: 2 }, tenantUser);
});

test('ContainersService.createMovement rejects returned containers above current balance', async () => {
  const calls: string[] = [];
  const service = new ContainersService(
    {
      customer: { findFirst: () => ({ id: 'customer-a' }) },
      containerType: { findFirst: () => ({ id: 'container-a' }) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          containerMovement: {
            create: () => {
              calls.push('movement.create');
              return { id: 'movement-a' };
            }
          },
          customerContainerBalance: {
            findUnique: () => ({ balance: 1 }),
            upsert: () => {
              calls.push('balance.upsert');
            }
          }
        })
    } as never,
    { log: () => undefined } as never
  );

  await assert.rejects(
    service.createMovement({ customerId: 'customer-a', containerTypeId: 'container-a', type: 'RETURNED', quantity: 2 }, tenantUser),
    /El cliente tiene 1 envases disponibles para devolver/
  );
  assert.deepEqual(calls, []);
});
