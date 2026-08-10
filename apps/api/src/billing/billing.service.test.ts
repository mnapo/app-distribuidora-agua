import test from 'node:test';
import assert from 'node:assert/strict';
import { BillingService } from './billing.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['billing.create_invoice']
};

test('BillingService.createInvoice creates invoice and account movement in transaction', async () => {
  const calls: string[] = [];
  const service = new BillingService(
    {
      customer: { findFirst: () => ({ id: 'customer-a' }) },
      invoice: { count: () => 0 },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          invoice: {
            create: (args: { data: { total: number; balance: number } }) => {
              calls.push('invoice.create');
              assert.equal(args.data.total, 121);
              assert.equal(args.data.balance, 121);
              return { id: 'invoice-a' };
            }
          },
          accountMovement: {
            findFirst: () => null,
            create: (args: { data: { debit: number; credit: number; balanceAfter: number } }) => {
              calls.push('account.create');
              assert.equal(args.data.debit, 121);
              assert.equal(args.data.credit, 0);
              assert.equal(args.data.balanceAfter, 121);
            }
          }
        })
    } as never,
    { log: () => undefined } as never
  );

  await service.createInvoice(
    {
      customerId: 'customer-a',
      items: [{ description: 'Bidon', quantity: 1, unitPrice: 100, tax: 21 }]
    },
    tenantUser
  );

  assert.deepEqual(calls, ['invoice.create', 'account.create']);
});

test('BillingService.createPayment credits account movement and updates invoice balance', async () => {
  const calls: string[] = [];
  const service = new BillingService(
    {
      customer: { findFirst: () => ({ id: 'customer-a' }) },
      invoice: { count: () => 1 },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          payment: {
            create: () => ({ id: 'payment-a', reference: null }),
            findUniqueOrThrow: () => ({ id: 'payment-a', allocations: [] })
          },
          paymentAllocation: { create: () => calls.push('allocation.create') },
          invoice: {
            findUniqueOrThrow: () => ({ id: 'invoice-a', total: 100, paidTotal: 0 }),
            update: (args: { data: { paidTotal: number; balance: number; status: string } }) => {
              calls.push('invoice.update');
              assert.equal(args.data.paidTotal, 60);
              assert.equal(args.data.balance, 40);
              assert.equal(args.data.status, 'PARTIALLY_PAID');
            }
          },
          accountMovement: {
            findFirst: () => ({ balanceAfter: 100 }),
            create: (args: { data: { credit: number; balanceAfter: number } }) => {
              calls.push('account.create');
              assert.equal(args.data.credit, 60);
              assert.equal(args.data.balanceAfter, 40);
            }
          }
        })
    } as never,
    { log: () => undefined } as never
  );

  await service.createPayment({ customerId: 'customer-a', amount: 60, allocations: [{ invoiceId: 'invoice-a', amount: 60 }] }, tenantUser);

  assert.deepEqual(calls, ['allocation.create', 'invoice.update', 'account.create']);
});

test('BillingService.createAutoAllocatedPayment applies oldest invoice balances first', async () => {
  const allocations: { invoiceId: string; amount: number }[] = [];
  const service = new BillingService(
    {
      customer: { findFirst: () => ({ id: 'customer-a' }) },
      invoice: {
        findMany: () => [
          { id: 'invoice-old', balance: 70 },
          { id: 'invoice-new', balance: 50 }
        ],
        count: () => 2
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          payment: {
            create: (args: { data: { unappliedAmount: number } }) => {
              assert.equal(args.data.unappliedAmount, 0);
              return { id: 'payment-a', reference: null };
            },
            findUniqueOrThrow: () => ({ id: 'payment-a', allocations })
          },
          paymentAllocation: {
            create: (args: { data: { invoiceId: string; amount: number } }) => allocations.push({ invoiceId: args.data.invoiceId, amount: args.data.amount })
          },
          invoice: {
            findUniqueOrThrow: (args: { where: { id: string } }) =>
              args.where.id === 'invoice-old' ? { id: 'invoice-old', total: 70, paidTotal: 0 } : { id: 'invoice-new', total: 50, paidTotal: 0 },
            update: () => undefined
          },
          accountMovement: {
            findFirst: () => ({ balanceAfter: 120 }),
            create: () => undefined
          }
        })
    } as never,
    { log: () => undefined } as never
  );

  await service.createAutoAllocatedPayment({ customerId: 'customer-a', amount: 100, method: 'TRANSFER' }, tenantUser);

  assert.deepEqual(allocations, [
    { invoiceId: 'invoice-old', amount: 70 },
    { invoiceId: 'invoice-new', amount: 30 }
  ]);
});
