import test from 'node:test';
import assert from 'node:assert/strict';
import { AlertsService } from './alerts.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['alerts.run']
};

test('AlertsService.scan creates overdue invoice alert and pending notification', async () => {
  const calls: string[] = [];
  const rule = { id: 'rule-a', tenantId: 'tenant-a', code: 'overdue-invoices', name: 'Facturas vencidas', type: 'OVERDUE_INVOICE', severity: 'HIGH', channel: 'IN_APP', thresholdDays: 0, active: true };
  const service = new AlertsService(
    {
      alertRule: { upsert: () => rule, findMany: () => [rule] },
      invoice: { findMany: () => [{ id: 'invoice-a', number: 'FAC-1', balance: 100, dueAt: new Date(), customer: {} }] },
      customer: { findMany: () => [] },
      customerSubscription: { findMany: () => [] },
      dispenserMaintenance: { findMany: () => [] },
      scheduledTask: { upsert: () => undefined },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          alert: {
            upsert: () => {
              calls.push('alert.upsert');
              return { id: 'alert-a', title: 'Factura vencida FAC-1' };
            }
          },
          notification: {
            findFirst: () => null,
            create: () => calls.push('notification.create')
          }
        })
    } as never,
    { log: () => undefined } as never
  );

  const result = await service.scan(tenantUser);

  assert.equal(result.scanned, 1);
  assert.deepEqual(calls, ['alert.upsert', 'notification.create']);
});
