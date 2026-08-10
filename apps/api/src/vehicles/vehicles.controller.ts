import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { VehiclesService } from './vehicles.service.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { ListQueryDto } from '../commercial/dto/list-query.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(@Inject(VehiclesService) private readonly vehicles: VehiclesService) {}

  @Permissions('vehicles.view')
  @Get()
  findAll(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vehicles.findAll(query, user);
  }

  @Permissions('vehicles.create')
  @Post()
  create(@Body() dto: CreateVehicleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vehicles.create(dto, user);
  }

  @Permissions('vehicles.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vehicles.update(id, dto, user);
  }
}
