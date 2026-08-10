import test from 'node:test';
import assert from 'node:assert/strict';
import { DispensersService } from './dispensers.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['dispensers.update']
};

test('DispensersService.createComodato marks dispenser on loan and records movement', async () => {
  const calls: string[] = [];
  const service = new DispensersService(
    {
      customer: { findFirst: () => ({ id: 'customer-a' }) },
      dispenser: { findFirst: () => ({ id: 'dispenser-a', status: 'AVAILABLE' }) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          dispenserComodato: { create: () => ({ id: 'comodato-a' }) },
          dispenser: {
            update: (args: { data: { status: string; currentCustomerId: string } }) => {
              calls.push('dispenser.update');
              assert.equal(args.data.status, 'ON_LOAN');
              assert.equal(args.data.currentCustomerId, 'customer-a');
            }
          },
          dispenserMovement: {
            create: (args: { data: { type: string; customerId: string } }) => {
              calls.push('movement.create');
              assert.equal(args.data.type, 'DELIVERED');
              assert.equal(args.data.customerId, 'customer-a');
            }
          }
        })
    } as never,
    { log: () => undefined } as never
  );

  await service.createComodato({ dispenserId: 'dispenser-a', customerId: 'customer-a' }, tenantUser);

  assert.deepEqual(calls, ['dispenser.update', 'movement.create']);
});
