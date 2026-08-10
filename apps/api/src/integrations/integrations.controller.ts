import { Body, Controller, Get, Param, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { CreateIntegrationEventDto } from './dto/create-integration-event.dto.js';
import { CreatePublicApiKeyDto } from './dto/create-public-api-key.dto.js';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto.js';
import { IntegrationsQueryDto } from './dto/integrations-query.dto.js';
import { UpsertIntegrationDto } from './dto/upsert-integration.dto.js';
import { IntegrationsService } from './integrations.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(@Inject(IntegrationsService) private readonly integrations: IntegrationsService) {}

  @Permissions('integrations.view')
  @Get()
  findAll(@Query() query: IntegrationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.findAll(query, user);
  }

  @Permissions('integrations.manage')
  @Post()
  upsert(@Body() dto: UpsertIntegrationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.upsert(dto, user);
  }

  @Permissions('integrations.view')
  @Get('webhooks')
  webhooks(@Query() query: IntegrationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.webhooks(query, user);
  }

  @Permissions('integrations.manage')
  @Post('webhooks')
  createWebhook(@Body() dto: CreateWebhookEndpointDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.createWebhook(dto, user);
  }

  @Permissions('integrations.view')
  @Get('events')
  events(@Query() query: IntegrationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.events(query, user);
  }

  @Permissions('integrations.manage')
  @Post('events')
  createEvent(@Body() dto: CreateIntegrationEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.createEvent(dto, user);
  }

  @Permissions('integrations.manage')
  @Post('events/process')
  processEvents(@CurrentUser() user: AuthenticatedUser) {
    return this.integrations.processEvents(user);
  }

  @Permissions('public_api.manage')
  @Get('api-keys')
  apiKeys(@Query() query: IntegrationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.apiKeys(query, user);
  }

  @Permissions('public_api.manage')
  @Post('api-keys')
  createApiKey(@Body() dto: CreatePublicApiKeyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.createApiKey(dto, user);
  }

  @Permissions('public_api.manage')
  @Post('api-keys/:id/revoke')
  revokeApiKey(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.revokeApiKey(id, user);
  }
}
