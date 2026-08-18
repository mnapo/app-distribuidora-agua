import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { DeliveryRoutesService } from './delivery-routes.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['delivery_routes.create']
};

test('DeliveryRoutesService.create rejects orders that are not available for tenant routing', async () => {
  const service = new DeliveryRoutesService(
    {
      warehouse: { findFirst: () => ({ id: 'warehouse-a' }) },
      driver: { findFirst: () => ({ id: 'driver-a' }) },
      vehicle: { findFirst: () => ({ id: 'vehicle-a' }) },
      order: {
        count: (args: { where: unknown }) => {
          assert.deepEqual(args.where, {
            tenantId: 'tenant-a',
            id: { in: ['order-b'] },
            status: { in: ['CONFIRMED', 'ASSIGNED', 'FAILED_DELIVERY'] }
          });
          return 0;
        }
      }
    } as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.create(
        {
          name: 'Ruta manana',
          routeDate: '2026-08-09T09:00:00.000Z',
          warehouseId: 'warehouse-a',
          driverId: 'driver-a',
          vehicleId: 'vehicle-a',
          orders: [{ orderId: 'order-b', sequence: 1 }]
        },
        tenantUser
      ),
    ForbiddenException
  );
});

test('DeliveryRoutesService.closePreliminary invoices delivered stops, applies partial payment, and releases failed orders', async () => {
  const calls: string[] = [];
  const service = new DeliveryRoutesService(
    {
      deliveryRoute: {
        findFirst: () => ({
          id: 'route-a',
          tenantId: 'tenant-a',
          status: 'LOADED',
          orders: [
            {
              id: 'route-order-delivered',
              tenantId: 'tenant-a',
              routeId: 'route-a',
              orderId: 'order-delivered',
              sequence: 1,
              stopStatus: 'DELIVERED',
              collectedAmount: 40,
              paymentMethod: 'CASH',
              observations: 'Pago parcial',
              failureReason: null,
              order: { id: 'order-delivered', tenantId: 'tenant-a', customerId: 'customer-a', status: 'ASSIGNED', invoices: [] },
              deliveredItems: [
                { productId: 'product-a', deliveredQuantity: 1, unitPrice: 100, lineTotal: 100, product: { name: 'Bidon', tax: 0 } }
              ],
              invoices: []
            },
            {
              id: 'route-order-failed',
              tenantId: 'tenant-a',
              routeId: 'route-a',
              orderId: 'order-failed',
              sequence: 2,
              stopStatus: 'FAILED',
              collectedAmount: 0,
              paymentMethod: 'CASH',
              observations: null,
              failureReason: 'Cliente ausente',
              order: { id: 'order-failed', tenantId: 'tenant-a', customerId: 'customer-b', status: 'ASSIGNED', invoices: [] },
              deliveredItems: [],
              invoices: []
            }
          ]
        }),
        update: () => undefined
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          invoice: {
            count: () => 0,
            create: (args: { data: { total: number; balance: number } }) => {
              calls.push('invoice.create');
              assert.equal(args.data.total, 100);
              assert.equal(args.data.balance, 100);
              return { id: 'invoice-a', total: 100, paidTotal: 0, balance: 100 };
            },
            update: (args: { data: { status: string; paidTotal: number; balance: number } }) => {
              calls.push('invoice.update');
              assert.equal(args.data.status, 'PARTIALLY_PAID');
              assert.equal(args.data.paidTotal, 40);
              assert.equal(args.data.balance, 60);
            }
          },
          accountMovement: {
            findFirst: () => null,
            create: () => {
              calls.push('accountMovement.create');
            }
          },
          payment: {
            create: (args: { data: { amount: number; unappliedAmount: number } }) => {
              calls.push('payment.create');
              assert.equal(args.data.amount, 40);
              assert.equal(args.data.unappliedAmount, 0);
              return { id: 'payment-a' };
            }
          },
          paymentAllocation: {
            create: (args: { data: { amount: number } }) => {
              calls.push('paymentAllocation.create');
              assert.equal(args.data.amount, 40);
            }
          },
          order: {
            update: (args: { data: { status: string } }) => {
              calls.push(`order.${args.data.status}`);
            }
          },
          orderHistory: {
            create: () => {
              calls.push('orderHistory.create');
            }
          },
          deliveryRoute: {
            update: () => {
              calls.push('route.update');
              return { id: 'route-a', status: 'CLOSED_PRELIMINARY' };
            }
          },
          deliveryRouteHistory: {
            create: () => {
              calls.push('routeHistory.create');
            }
          }
        })
    } as never,
    {
      log: () => undefined
    } as never
  );

  await service.closePreliminary('route-a', {}, tenantUser);

  assert.ok(calls.includes('invoice.create'));
  assert.ok(calls.includes('payment.create'));
  assert.ok(calls.includes('invoice.update'));
  assert.ok(calls.includes('order.DELIVERED'));
  assert.ok(calls.includes('order.FAILED_DELIVERY'));
  assert.ok(calls.includes('route.update'));
});

test('DeliveryRoutesService.closePreliminary reuses manual order invoice for route payment', async () => {
  const calls: string[] = [];
  const service = new DeliveryRoutesService(
    {
      deliveryRoute: {
        findFirst: () => ({
          id: 'route-a',
          tenantId: 'tenant-a',
          status: 'LOADED',
          orders: [
            {
              id: 'route-order-delivered',
              tenantId: 'tenant-a',
              routeId: 'route-a',
              orderId: 'order-delivered',
              sequence: 1,
              stopStatus: 'DELIVERED',
              collectedAmount: 40,
              paymentMethod: 'CASH',
              observations: 'Pago parcial',
              failureReason: null,
              order: {
                id: 'order-delivered',
                tenantId: 'tenant-a',
                customerId: 'customer-a',
                status: 'ASSIGNED',
                invoices: [{ id: 'invoice-manual', status: 'ISSUED', total: 100, paidTotal: 0, balance: 100 }]
              },
              deliveredItems: [
                { productId: 'product-a', deliveredQuantity: 1, unitPrice: 100, lineTotal: 100, product: { name: 'Bidon', tax: 0 } }
              ],
              invoices: []
            }
          ]
        }),
        update: () => undefined
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          invoice: {
            create: () => {
              throw new Error('manual invoice should be reused');
            },
            update: (args: { data: { status: string; paidTotal: number; balance: number } }) => {
              calls.push('invoice.update');
              assert.equal(args.data.status, 'PARTIALLY_PAID');
              assert.equal(args.data.paidTotal, 40);
              assert.equal(args.data.balance, 60);
            }
          },
          accountMovement: {
            findFirst: () => null,
            create: () => calls.push('accountMovement.create')
          },
          payment: {
            create: (args: { data: { amount: number; unappliedAmount: number } }) => {
              calls.push('payment.create');
              assert.equal(args.data.amount, 40);
              assert.equal(args.data.unappliedAmount, 0);
              return { id: 'payment-a' };
            }
          },
          paymentAllocation: {
            create: (args: { data: { invoiceId: string; amount: number } }) => {
              calls.push('paymentAllocation.create');
              assert.equal(args.data.invoiceId, 'invoice-manual');
              assert.equal(args.data.amount, 40);
            }
          },
          order: {
            update: (args: { data: { status: string } }) => calls.push(`order.${args.data.status}`)
          },
          orderHistory: {
            create: () => calls.push('orderHistory.create')
          },
          deliveryRoute: {
            update: () => {
              calls.push('route.update');
              return { id: 'route-a', status: 'CLOSED_PRELIMINARY' };
            }
          },
          deliveryRouteHistory: {
            create: () => calls.push('routeHistory.create')
          }
        })
    } as never,
    { log: () => undefined } as never
  );

  await service.closePreliminary('route-a', {}, tenantUser);

  assert.ok(calls.includes('paymentAllocation.create'));
  assert.ok(calls.includes('invoice.update'));
  assert.ok(calls.includes('order.DELIVERED'));
  assert.ok(calls.includes('route.update'));
});

test('DeliveryRoutesService.loadVehicle aggregates route items and creates inventory movement', async () => {
  const calls: string[] = [];
  const service = new DeliveryRoutesService(
    {
      deliveryRoute: {
        findFirst: () => ({
          id: 'route-a',
          tenantId: 'tenant-a',
          warehouseId: 'warehouse-a',
          vehicleId: 'vehicle-a',
          status: 'PREPARED',
          orders: [
            { order: { items: [{ productId: 'product-a', quantity: 2 }, { productId: 'product-a', quantity: 3 }] } }
          ]
        })
      },
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
            create: (args: { data: { productId: string; quantity: number; type: string } }) => {
              calls.push('movement.create');
              assert.equal(args.data.productId, 'product-a');
              assert.equal(args.data.quantity, 5);
              assert.equal(args.data.type, 'VEHICLE_LOAD');
            }
          },
          deliveryRoute: {
            update: () => {
              calls.push('route.update');
              return { id: 'route-a', status: 'LOADED' };
            }
          },
          deliveryRouteHistory: {
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

  await service.loadVehicle('route-a', {}, tenantUser);

  assert.deepEqual(calls, ['transaction', 'inventory.create', 'inventory.create', 'movement.create', 'route.update', 'history.create']);
});
