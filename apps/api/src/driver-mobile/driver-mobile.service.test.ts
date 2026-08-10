import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DriverMobileService } from './driver-mobile.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const driverUser: AuthenticatedUser = {
  id: 'user-driver',
  tenantId: 'tenant-a',
  email: 'driver@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['driver_mobile.complete']
};

test('DriverMobileService.assignedRoutes rejects non-driver users', async () => {
  const service = new DriverMobileService(
    {
      driver: { findFirst: () => null }
    } as never,
    {} as never,
    {} as never,
    {} as never
  );

  await assert.rejects(() => service.assignedRoutes(driverUser), ForbiddenException);
});

test('DriverMobileService.completeStop requires GPS when tenant setting requires it', async () => {
  const service = new DriverMobileService(
    {
      offlineSyncOperation: { findUnique: () => null },
      driver: { findFirst: () => ({ id: 'driver-a' }) },
      deliveryRouteOrder: {
        findFirst: () => ({
          id: 'stop-a',
          tenantId: 'tenant-a',
          stopStatus: 'PENDING',
          route: { vehicleId: 'vehicle-a', driver: { id: 'driver-a' }, vehicle: { id: 'vehicle-a' } },
          order: {
            deliveryAddress: null,
            items: [{ productId: 'product-a', quantity: 1, unitPrice: 10, product: { id: 'product-a' } }]
          }
        })
      },
      tenantSetting: {
        findUnique: () => ({
          gpsMode: 'REQUIRED',
          requiresSignature: false,
          deliveryPhotoMode: 'DISABLED',
          allowDeliveryQuantityChanges: true,
          allowMobileAdditionalSales: false
        })
      }
    } as never,
    {} as never,
    {} as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.completeStop(
        'stop-a',
        { idempotencyKey: 'sync-1', items: [{ productId: 'product-a', deliveredQuantity: 1 }] },
        driverUser
      ),
    BadRequestException
  );
});

test('DriverMobileService.completeStop returns duplicate result for idempotency key', async () => {
  const service = new DriverMobileService(
    {
      offlineSyncOperation: {
        findUnique: () => ({ result: { id: 'stop-a', stopStatus: 'DELIVERED' } })
      }
    } as never,
    {} as never,
    {} as never,
    {} as never
  );

  const result = await service.completeStop(
    'stop-a',
    { idempotencyKey: 'sync-1', items: [{ productId: 'product-a', deliveredQuantity: 1 }] },
    driverUser
  );

  assert.deepEqual(result, { id: 'stop-a', stopStatus: 'DELIVERED' });
});
