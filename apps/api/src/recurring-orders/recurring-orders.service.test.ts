import test from 'node:test';
import assert from 'node:assert/strict';
import { RecurringOrdersService } from './recurring-orders.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['recurring_orders.generate']
};

test('RecurringOrdersService.generate skips already generated target dates', async () => {
  const calls: string[] = [];
  const service = new RecurringOrdersService(
    {
      recurringOrderRule: {
        findMany: () => [
          {
            id: 'rule-a',
            tenantId: 'tenant-a',
            customerId: 'customer-a',
            name: 'Semanal',
            frequency: 'WEEKLY',
            interval: 1,
            startDate: new Date('2026-08-03T00:00:00.000Z'),
            nextRunDate: new Date('2026-08-03T00:00:00.000Z'),
            endDate: null,
            daysOfWeek: null,
            dayOfMonth: null,
            deliveryAddressId: null,
            exceptions: [],
            customer: { id: 'customer-a' },
            items: [{ productId: 'product-a', quantity: 1, unitPrice: 10, discount: 0, product: { price: 10 } }]
          }
        ],
        update: () => undefined
      },
      recurringOrderGenerated: {
        findUnique: ({ where }: { where: { ruleId_targetDate: { targetDate: Date } } }) =>
          where.ruleId_targetDate.targetDate.getTime() === new Date('2026-08-03T00:00:00.000Z').getTime() ? { id: 'generated-a' } : null,
        create: () => calls.push('generated.create')
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          order: {
            create: () => {
              calls.push('order.create');
              return { id: 'order-b' };
            }
          },
          recurringOrderGenerated: {
            create: () => calls.push('generated.create')
          }
        })
    } as never,
    { log: () => undefined } as never
  );

  const result = await service.generate({ until: '2026-08-10T00:00:00.000Z' }, tenantUser);

  assert.equal(result.generated.length, 1);
  assert.deepEqual(calls, ['order.create', 'generated.create']);
});
