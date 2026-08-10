import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { PriceListsService } from './price-lists.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['price_lists.update']
};

test('PriceListsService.setCustomerProductPrice rejects customers from another tenant', async () => {
  const service = new PriceListsService(
    {
      customer: {
        findFirst: (args: { where: unknown }) => {
          assert.deepEqual(args.where, { id: 'customer-b', tenantId: 'tenant-a' });
          return null;
        }
      }
    } as never,
    {} as never
  );

  await assert.rejects(
    () => service.setCustomerProductPrice({ customerId: 'customer-b', productId: 'product-a', price: 10 }, tenantUser),
    ForbiddenException
  );
});

test('PriceListsService.create rejects products from another tenant', async () => {
  const service = new PriceListsService(
    {
      product: {
        count: (args: { where: unknown }) => {
          assert.deepEqual(args.where, { id: { in: ['product-b'] }, tenantId: 'tenant-a' });
          return 0;
        }
      }
    } as never,
    {} as never
  );

  await assert.rejects(
    () => service.create({ name: 'Minorista', items: [{ productId: 'product-b', price: 100 }] }, tenantUser),
    ForbiddenException
  );
});
