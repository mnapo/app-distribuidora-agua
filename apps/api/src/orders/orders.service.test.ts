import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['orders.create']
};

test('OrdersService.create rejects customers from another tenant', async () => {
  const service = new OrdersService(
    {
      customer: {
        findFirst: (args: { where: unknown }) => {
          assert.deepEqual(args.where, { id: 'customer-b', tenantId: 'tenant-a', status: 'ACTIVE' });
          return null;
        }
      }
    } as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.create(
        {
          customerId: 'customer-b',
          items: [{ productId: 'product-a', quantity: 1 }]
        },
        tenantUser
      ),
    ForbiddenException
  );
});

test('OrdersService.create resolves customer price and writes history in transaction', async () => {
  const calls: string[] = [];
  const service = new OrdersService(
    {
      customer: {
        findFirst: () => ({ id: 'customer-a', priceListId: null })
      },
      customerAddress: {
        findFirst: () => null
      },
      product: {
        findMany: () => [{ id: 'product-a', price: 100, active: true }]
      },
      customerProductPrice: {
        findMany: () => [{ productId: 'product-a', price: 80 }]
      },
      priceListItem: {
        findMany: () => []
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        calls.push('transaction');
        return callback({
          order: {
            aggregate: () => ({ _max: { number: 7 } }),
            create: (args: { data: { number: number; subtotal: number; discountTotal: number; total: number; items: { create: unknown[] } } }) => {
              calls.push('order.create');
              assert.equal(args.data.number, 8);
              assert.equal(args.data.subtotal, 160);
              assert.equal(args.data.discountTotal, 10);
              assert.equal(args.data.total, 150);
              assert.deepEqual(args.data.items.create[0], {
                tenantId: 'tenant-a',
                productId: 'product-a',
                quantity: 2,
                unitPrice: 80,
                discount: 10,
                lineSubtotal: 160,
                lineTotal: 150
              });
              return { id: 'order-a', customerId: 'customer-a', status: 'DRAFT', total: 150 };
            }
          },
          orderHistory: {
            create: () => {
              calls.push('history.create');
            }
          }
        });
      }
    } as never,
    {
      log: () => undefined
    } as never
  );

  await service.create(
    {
      customerId: 'customer-a',
      items: [{ productId: 'product-a', quantity: 2, discount: 10 }]
    },
    tenantUser
  );

  assert.deepEqual(calls, ['transaction', 'order.create', 'history.create']);
});

test('OrdersService.retryDelivery returns failed delivery to confirmed', async () => {
  const calls: string[] = [];
  const service = new OrdersService(
    {
      order: {
        findFirst: () => ({ id: 'order-a', tenantId: 'tenant-a', status: 'FAILED_DELIVERY', items: [{ id: 'item-a' }] })
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          order: {
            update: (args: { data: { status: string; assignedDriverId: null; assignedVehicleId: null; assignedAt: null } }) => {
              calls.push('order.update');
              assert.equal(args.data.status, 'CONFIRMED');
              assert.equal(args.data.assignedDriverId, null);
              assert.equal(args.data.assignedVehicleId, null);
              assert.equal(args.data.assignedAt, null);
              return { id: 'order-a', status: 'CONFIRMED' };
            }
          },
          orderHistory: {
            create: () => calls.push('history.create')
          }
        })
    } as never,
    { log: () => calls.push('audit.log') } as never
  );

  await service.retryDelivery('order-a', tenantUser);

  assert.deepEqual(calls, ['order.update', 'history.create', 'audit.log']);
});
