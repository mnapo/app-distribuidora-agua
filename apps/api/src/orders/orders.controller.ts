import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { AssignOrderDto } from './dto/assign-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersQueryDto } from './dto/orders-query.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { OrdersService } from './orders.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Permissions('orders.view')
  @Get()
  findAll(@Query() query: OrdersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.findAll(query, user);
  }

  @Permissions('orders.view')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.findOne(id, user);
  }

  @Permissions('orders.create')
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.create(dto, user);
  }

  @Permissions('orders.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.update(id, dto, user);
  }

  @Permissions('orders.confirm')
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.confirm(id, user);
  }

  @Permissions('orders.update')
  @Post(':id/retry-delivery')
  retryDelivery(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.retryDelivery(id, user);
  }

  @Permissions('orders.assign')
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.assign(id, dto, user);
  }

  @Permissions('orders.cancel')
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.cancel(id, dto, user);
  }
}
