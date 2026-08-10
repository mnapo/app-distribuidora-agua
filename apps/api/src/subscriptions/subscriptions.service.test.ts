import test from 'node:test';
import assert from 'node:assert/strict';
import { SubscriptionsService } from './subscriptions.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['subscriptions.view']
};

test('SubscriptionsService.summary returns included used remaining and excess quantities', async () => {
  const service = new SubscriptionsService(
    {
      customerSubscription: {
        findFirst: () => ({
          id: 'sub-a',
          tenantId: 'tenant-a',
          customer: { id: 'customer-a' },
          plan: {
            items: [
              { productId: 'product-a', includedQuantity: 10, product: { id: 'product-a', name: 'Bidon' } },
              { productId: 'product-b', includedQuantity: 2, product: { id: 'product-b', name: 'Soda' } }
            ]
          },
          usages: [
            { productId: 'product-a', quantity: 7 },
            { productId: 'product-a', quantity: 5 },
            { productId: 'product-b', quantity: 1 }
          ]
        })
      }
    } as never,
    {} as never
  );

  const result = await service.summary('sub-a', tenantUser);

  assert.deepEqual(
    result.rows.map((row) => ({ product: row.product.id, included: row.included, used: row.used, remaining: row.remaining, excess: row.excess })),
    [
      { product: 'product-a', included: 10, used: 12, remaining: 0, excess: 2 },
      { product: 'product-b', included: 2, used: 1, remaining: 1, excess: 0 }
    ]
  );
});
