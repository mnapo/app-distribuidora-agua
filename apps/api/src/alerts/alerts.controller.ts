import { Body, Controller, Get, Param, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { AlertsQueryDto } from './dto/alerts-query.dto.js';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto.js';
import { CreateManualAlertDto } from './dto/create-manual-alert.dto.js';
import { AlertsService } from './alerts.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('alerts')
export class AlertsController {
  constructor(@Inject(AlertsService) private readonly alerts: AlertsService) {}

  @Permissions('alerts.view')
  @Get('rules')
  rules(@Query() query: AlertsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.alerts.rules(query, user);
  }

  @Permissions('alerts.manage')
  @Post('rules')
  createRule(@Body() dto: CreateAlertRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.alerts.createRule(dto, user);
  }

  @Permissions('alerts.view')
  @Get()
  findAll(@Query() query: AlertsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.alerts.findAll(query, user);
  }

  @Permissions('alerts.manage')
  @Post()
  createManual(@Body() dto: CreateManualAlertDto, @CurrentUser() user: AuthenticatedUser) {
    return this.alerts.createManual(dto, user);
  }

  @Permissions('alerts.manage')
  @Post(':id/acknowledge')
  acknowledge(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.alerts.acknowledge(id, user);
  }

  @Permissions('alerts.manage')
  @Post(':id/resolve')
  resolve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.alerts.resolve(id, user);
  }

  @Permissions('alerts.run')
  @Post('scan')
  scan(@CurrentUser() user: AuthenticatedUser) {
    return this.alerts.scan(user);
  }

  @Permissions('notifications.view')
  @Get('notifications/list')
  notifications(@Query() query: AlertsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.alerts.notifications(query, user);
  }

  @Permissions('notifications.dispatch')
  @Post('notifications/dispatch')
  dispatch(@CurrentUser() user: AuthenticatedUser) {
    return this.alerts.dispatch(user);
  }
}
