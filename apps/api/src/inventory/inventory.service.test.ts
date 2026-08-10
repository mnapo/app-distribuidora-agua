import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['inventory.create_movement']
};

test('InventoryService.createMovement rejects products from another tenant', async () => {
  const service = new InventoryService(
    {
      product: {
        findFirst: (args: { where: unknown }) => {
          assert.deepEqual(args.where, { id: 'product-b', tenantId: 'tenant-a' });
          return null;
        }
      }
    } as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.createMovement(
        { productId: 'product-b', type: 'PURCHASE', quantity: 1, toWarehouseId: 'warehouse-a' },
        tenantUser
      ),
    ForbiddenException
  );
});

test('InventoryService.createMovement creates movement inside a transaction', async () => {
  const calls: string[] = [];
  const service = new InventoryService(
    {
      product: { findFirst: () => ({ id: 'product-a' }) },
      warehouse: { findFirst: () => ({ id: 'warehouse-a' }) },
      vehicle: { findFirst: () => null },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        calls.push('transaction');
        return callback({
          inventory: {
            findFirst: () => null,
            create: () => {
              calls.push('inventory.create');
            }
          },
          inventoryMovement: {
            create: () => {
              calls.push('movement.create');
              return { id: 'movement-a' };
            }
          }
        });
      }
    } as never,
    {
      log: () => undefined
    } as never
  );

  await service.createMovement(
    { productId: 'product-a', type: 'PURCHASE', quantity: 5, toWarehouseId: 'warehouse-a' },
    tenantUser
  );

  assert.deepEqual(calls, ['transaction', 'inventory.create', 'movement.create']);
});
