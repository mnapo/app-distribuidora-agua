import { Body, Controller, Get, Param, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { CreateCustomerSubscriptionDto } from './dto/create-customer-subscription.dto.js';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto.js';
import { RecordSubscriptionUsageDto } from './dto/record-subscription-usage.dto.js';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { ListQueryDto } from '../commercial/dto/list-query.dto.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(@Inject(SubscriptionsService) private readonly subscriptionsService: SubscriptionsService) {}

  @Permissions('subscriptions.view')
  @Get('plans')
  plans(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.plans(query, user);
  }

  @Permissions('subscriptions.create')
  @Post('plans')
  createPlan(@Body() dto: CreateSubscriptionPlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.createPlan(dto, user);
  }

  @Permissions('subscriptions.view')
  @Get()
  subscriptions(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.subscriptions(query, user);
  }

  @Permissions('subscriptions.create')
  @Post()
  createSubscription(@Body() dto: CreateCustomerSubscriptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.createSubscription(dto, user);
  }

  @Permissions('subscriptions.use')
  @Post('usage')
  recordUsage(@Body() dto: RecordSubscriptionUsageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.recordUsage(dto, user);
  }

  @Permissions('subscriptions.view')
  @Get(':id/summary')
  summary(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.summary(id, user);
  }

  @Permissions('subscriptions.update')
  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() dto: RenewSubscriptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.renew(id, dto, user);
  }

  @Permissions('subscriptions.update')
  @Post(':id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.suspend(id, user);
  }

  @Permissions('subscriptions.update')
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.cancel(id, user);
  }
}
