import { randomBytes, createHash } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { IntegrationProvider, IntegrationStatus, Prisma } from '@prisma/client';
import { CreateIntegrationEventDto } from './dto/create-integration-event.dto.js';
import { CreatePublicApiKeyDto } from './dto/create-public-api-key.dto.js';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto.js';
import { IntegrationsQueryDto } from './dto/integrations-query.dto.js';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto.js';
import { pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class IntegrationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: IntegrationsQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.ExternalIntegrationWhereInput = { tenantId, provider: this.providerFilter(query.provider), status: this.statusFilter(query.status) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.externalIntegration.findMany({ where, orderBy: { provider: 'asc' }, ...pageArgs(query) }),
      this.prisma.externalIntegration.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async upsert(dto: UpsertIntegrationDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const integration = await this.prisma.externalIntegration.upsert({
      where: { tenantId_provider: { tenantId, provider: dto.provider } },
      update: {
        name: dto.name.trim(),
        status: dto.status ?? 'CONFIGURED',
        config: dto.config as Prisma.InputJsonValue | undefined,
        credentials: dto.credentials as Prisma.InputJsonValue | undefined
      },
      create: {
        tenantId,
        provider: dto.provider,
        name: dto.name.trim(),
        status: dto.status ?? 'CONFIGURED',
        config: dto.config as Prisma.InputJsonValue | undefined,
        credentials: dto.credentials as Prisma.InputJsonValue | undefined
      }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'integrations.upsert', entity: 'ExternalIntegration', entityId: integration.id, newValues: { provider: integration.provider, status: integration.status } });
    return integration;
  }

  async webhooks(query: IntegrationsQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.WebhookEndpointWhereInput = { tenantId, active: query.active, name: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.webhookEndpoint.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.webhookEndpoint.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createWebhook(dto: CreateWebhookEndpointDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const webhook = await this.prisma.webhookEndpoint.create({
      data: { tenantId, name: dto.name.trim(), url: dto.url.trim(), events: dto.events.trim(), secret: dto.secret?.trim(), active: dto.active }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'integrations.webhooks.create', entity: 'WebhookEndpoint', entityId: webhook.id, newValues: { url: webhook.url } });
    return webhook;
  }

  async events(query: IntegrationsQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.IntegrationEventWhereInput = { tenantId, status: query.status ? (query.status as never) : undefined, type: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.integrationEvent.findMany({ where, include: { integration: true }, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.integrationEvent.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createEvent(dto: CreateIntegrationEventDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    if (dto.integrationId) await this.assertIntegration(dto.integrationId, tenantId);
    return this.prisma.integrationEvent.create({
      data: { tenantId, integrationId: dto.integrationId, type: dto.type.trim(), payload: dto.payload as Prisma.InputJsonValue }
    });
  }

  async processEvents(user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const events = await this.prisma.integrationEvent.findMany({ where: { tenantId, status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 50, include: { integration: true } });
    const processed = [];
    for (const event of events) {
      const canProcess = !event.integration || event.integration.status === 'ACTIVE';
      processed.push(
        await this.prisma.integrationEvent.update({
          where: { id: event.id },
          data: canProcess
            ? { status: 'PROCESSED', processedAt: new Date(), attempts: { increment: 1 }, lastError: null }
            : { status: 'FAILED', attempts: { increment: 1 }, lastError: 'Integration is not active' }
        })
      );
    }
    await this.prisma.scheduledTask.upsert({
      where: { tenantId_code: { tenantId, code: 'integrations.process_events' } },
      update: { type: 'INTEGRATION_SYNC', status: 'IDLE', lastRunAt: new Date(), error: null },
      create: { tenantId, code: 'integrations.process_events', type: 'INTEGRATION_SYNC', status: 'IDLE', lastRunAt: new Date() }
    });
    return { processed: processed.length, events: processed };
  }

  async apiKeys(query: IntegrationsQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.PublicApiKeyWhereInput = { tenantId, active: query.active, name: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.publicApiKey.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.publicApiKey.count({ where })
    ]);
    return { data: data.map((item) => ({ ...item, keyHash: undefined })), meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createApiKey(dto: CreatePublicApiKeyDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const rawKey = `ad_${randomBytes(24).toString('hex')}`;
    const apiKey = await this.prisma.publicApiKey.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        keyHash: this.hash(rawKey),
        scopes: dto.scopes.trim(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined
      }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'integrations.api_keys.create', entity: 'PublicApiKey', entityId: apiKey.id, newValues: { name: apiKey.name, scopes: apiKey.scopes } });
    return { apiKey: { ...apiKey, keyHash: undefined }, token: rawKey };
  }

  async revokeApiKey(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const apiKey = await this.prisma.publicApiKey.findFirst({ where: { id, tenantId } });
    if (!apiKey) throw new NotFoundException('API key not found');
    return this.prisma.publicApiKey.update({ where: { id }, data: { active: false } });
  }

  private async assertIntegration(id: string, tenantId: string): Promise<void> {
    const integration = await this.prisma.externalIntegration.findFirst({ where: { id, tenantId } });
    if (!integration) throw new ForbiddenException('Integration does not belong to this tenant');
  }

  private providerFilter(provider: string | undefined): IntegrationProvider | undefined {
    return Object.values(IntegrationProvider).includes(provider as IntegrationProvider) ? (provider as IntegrationProvider) : undefined;
  }

  private statusFilter(status: string | undefined): IntegrationStatus | undefined {
    return Object.values(IntegrationStatus).includes(status as IntegrationStatus) ? (status as IntegrationStatus) : undefined;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
