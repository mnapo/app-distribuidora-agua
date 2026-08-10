import test from 'node:test';
import assert from 'node:assert/strict';
import { ReportsService } from './reports.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['reports.view']
};

test('ReportsService.kpis returns values calculated from transactional aggregates', async () => {
  const service = new ReportsService({
    invoice: { aggregate: (args: { where: { balance?: { gt: number } } }) => (args.where.balance ? { _sum: { balance: 60 } } : { _sum: { total: 150 }, _count: 2 }) },
    payment: { aggregate: () => ({ _sum: { amount: 90 }, _count: 1 }) },
    customer: { count: (args: { where: { status?: string } }) => (args.where.status === 'ACTIVE' ? 2 : 3) },
    deliveryRoute: { count: () => 4 },
    deliveryRouteOrder: { count: () => 5 },
    product: { count: () => 6, findMany: () => [{ id: 'product-a', name: 'Bidon' }] },
    customerContainerBalance: { aggregate: () => ({ _sum: { balance: 8 } }) },
    dispenser: { groupBy: () => [{ status: 'AVAILABLE', _count: 1 }, { status: 'ON_LOAN', _count: 2 }] },
    deliveryStopItem: { aggregate: () => ({ _sum: { deliveredQuantity: 40 } }) },
    invoiceItem: { groupBy: () => [{ productId: 'product-a', _sum: { quantity: 4, lineTotal: 120 } }] },
    $transaction: (operations: unknown[]) => operations,
  } as never);

  const result = await service.kpis({}, tenantUser);

  assert.equal(result.sales.amount, 150);
  assert.equal(result.collections.amount, 90);
  assert.equal(result.debt.amount, 60);
  assert.equal(result.customers.active, 2);
  assert.equal(result.dispensers.ON_LOAN, 2);
  assert.deepEqual(result.products.top[0], { productId: 'product-a', name: 'Bidon', quantity: 4, amount: 120 });
});
