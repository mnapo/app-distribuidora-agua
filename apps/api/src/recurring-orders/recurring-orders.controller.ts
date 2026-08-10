import { Body, Controller, Get, Param, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { CreateRecurringExceptionDto } from './dto/create-recurring-exception.dto.js';
import { CreateRecurringOrderRuleDto } from './dto/create-recurring-order-rule.dto.js';
import { GenerateRecurringOrdersDto } from './dto/generate-recurring-orders.dto.js';
import { RecurringOrdersService } from './recurring-orders.service.js';
import { ListQueryDto } from '../commercial/dto/list-query.dto.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('recurring-orders')
export class RecurringOrdersController {
  constructor(@Inject(RecurringOrdersService) private readonly recurring: RecurringOrdersService) {}

  @Permissions('recurring_orders.view')
  @Get('rules')
  findAll(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.recurring.findAll(query, user);
  }

  @Permissions('recurring_orders.create')
  @Post('rules')
  create(@Body() dto: CreateRecurringOrderRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.recurring.create(dto, user);
  }

  @Permissions('recurring_orders.update')
  @Post('rules/:id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.recurring.suspend(id, user);
  }

  @Permissions('recurring_orders.update')
  @Post('rules/:id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.recurring.activate(id, user);
  }

  @Permissions('recurring_orders.update')
  @Post('rules/:id/exceptions')
  createException(@Param('id') id: string, @Body() dto: CreateRecurringExceptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.recurring.createException(id, dto, user);
  }

  @Permissions('recurring_orders.generate')
  @Post('generate')
  generate(@Body() dto: GenerateRecurringOrdersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.recurring.generate(dto, user);
  }
}
