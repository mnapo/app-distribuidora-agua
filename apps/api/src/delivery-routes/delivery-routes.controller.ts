import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { CreateDeliveryRouteDto } from './dto/create-delivery-route.dto.js';
import { DeliveryRoutesQueryDto } from './dto/delivery-routes-query.dto.js';
import { RouteActionDto } from './dto/route-action.dto.js';
import { UpdateDeliveryRouteDto } from './dto/update-delivery-route.dto.js';
import { DeliveryRoutesService } from './delivery-routes.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('delivery-routes')
export class DeliveryRoutesController {
  constructor(@Inject(DeliveryRoutesService) private readonly routes: DeliveryRoutesService) {}

  @Permissions('delivery_routes.view')
  @Get()
  findAll(@Query() query: DeliveryRoutesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.routes.findAll(query, user);
  }

  @Permissions('delivery_routes.view')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.routes.findOne(id, user);
  }

  @Permissions('delivery_routes.create')
  @Post()
  create(@Body() dto: CreateDeliveryRouteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.routes.create(dto, user);
  }

  @Permissions('delivery_routes.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryRouteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.routes.update(id, dto, user);
  }

  @Permissions('delivery_routes.prepare')
  @Post(':id/prepare')
  prepare(@Param('id') id: string, @Body() dto: RouteActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.routes.prepare(id, dto, user);
  }

  @Permissions('delivery_routes.load')
  @Post(':id/load-vehicle')
  loadVehicle(@Param('id') id: string, @Body() dto: RouteActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.routes.loadVehicle(id, dto, user);
  }

  @Permissions('delivery_routes.close')
  @Post(':id/close-preliminary')
  closePreliminary(@Param('id') id: string, @Body() dto: RouteActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.routes.closePreliminary(id, dto, user);
  }

  @Permissions('delivery_routes.cancel')
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: RouteActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.routes.cancel(id, dto, user);
  }
}
