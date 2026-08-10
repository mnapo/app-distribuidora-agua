import test from 'node:test';
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['products.create']
};

test('ProductsService.create rejects categories from another tenant', async () => {
  const service = new ProductsService(
    {
      productCategory: {
        findFirst: (args: { where: unknown }) => {
          assert.deepEqual(args.where, { id: 'category-b', tenantId: 'tenant-a' });
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
          sku: 'B20',
          name: 'Bidon 20 L',
          unit: 'unidad',
          categoryId: 'category-b'
        },
        tenantUser
      ),
    ForbiddenException
  );
});
