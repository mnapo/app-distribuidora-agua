import test from 'node:test';
import assert from 'node:assert/strict';
import { IntegrationsService } from './integrations.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

const tenantUser: AuthenticatedUser = {
  id: 'actor-1',
  tenantId: 'tenant-a',
  email: 'admin@tenant-a.local',
  isPlatformAdmin: false,
  permissions: ['public_api.manage']
};

test('IntegrationsService.createApiKey stores only hash and returns token once', async () => {
  const service = new IntegrationsService(
    {
      publicApiKey: {
        create: (args: { data: { keyHash: string; scopes: string } }) => {
          assert.equal(args.data.scopes, 'reports.read');
          assert.match(args.data.keyHash, /^[a-f0-9]{64}$/);
          return { id: 'key-a', name: 'Reporting', keyHash: args.data.keyHash, scopes: args.data.scopes, active: true };
        }
      }
    } as never,
    { log: () => undefined } as never
  );

  const result = await service.createApiKey({ name: 'Reporting', scopes: 'reports.read' }, tenantUser);

  assert.match(result.token, /^ad_/);
  assert.equal(result.apiKey.keyHash, undefined);
});
