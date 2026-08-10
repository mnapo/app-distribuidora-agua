import { Body, Controller, Get, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto.js';
import { VehicleLoadDto } from './dto/vehicle-load.dto.js';
import { ListQueryDto } from '../commercial/dto/list-query.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  @Permissions('inventory.view')
  @Get()
  findAll(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.findAll(query, user);
  }

  @Permissions('inventory.view')
  @Get('movements')
  findMovements(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.findMovements(query, user);
  }

  @Permissions('inventory.create_movement')
  @Post('movements')
  createMovement(@Body() dto: CreateInventoryMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.createMovement(dto, user);
  }

  @Permissions('inventory.create_movement')
  @Post('vehicle-load')
  loadVehicle(@Body() dto: VehicleLoadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.loadVehicle(dto, user);
  }

  @Permissions('inventory.create_movement')
  @Post('vehicle-return')
  returnVehicleStock(@Body() dto: VehicleLoadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.returnVehicleStock(dto, user);
  }
}
