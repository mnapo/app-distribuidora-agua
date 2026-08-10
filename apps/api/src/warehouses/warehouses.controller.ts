import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { WarehousesService } from './warehouses.service.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';
import { ListQueryDto } from '../commercial/dto/list-query.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(@Inject(WarehousesService) private readonly warehouses: WarehousesService) {}

  @Permissions('warehouses.view')
  @Get()
  findAll(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.warehouses.findAll(query, user);
  }

  @Permissions('warehouses.create')
  @Post()
  create(@Body() dto: CreateWarehouseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.warehouses.create(dto, user);
  }

  @Permissions('warehouses.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.warehouses.update(id, dto, user);
  }
}
