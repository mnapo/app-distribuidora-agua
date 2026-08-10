import { Body, Controller, Get, Param, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { CompleteDispenserMaintenanceDto } from './dto/complete-dispenser-maintenance.dto.js';
import { CreateDispenserComodatoDto } from './dto/create-dispenser-comodato.dto.js';
import { CreateDispenserMaintenanceDto } from './dto/create-dispenser-maintenance.dto.js';
import { CreateDispenserModelDto } from './dto/create-dispenser-model.dto.js';
import { CreateDispenserDto } from './dto/create-dispenser.dto.js';
import { DispensersQueryDto } from './dto/dispensers-query.dto.js';
import { RetireDispenserComodatoDto } from './dto/retire-dispenser-comodato.dto.js';
import { DispensersService } from './dispensers.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('dispensers')
export class DispensersController {
  constructor(@Inject(DispensersService) private readonly dispensers: DispensersService) {}

  @Permissions('dispensers.view')
  @Get('models')
  models(@Query() query: DispensersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dispensers.models(query, user);
  }

  @Permissions('dispensers.create')
  @Post('models')
  createModel(@Body() dto: CreateDispenserModelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dispensers.createModel(dto, user);
  }

  @Permissions('dispensers.view')
  @Get()
  findAll(@Query() query: DispensersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dispensers.findAll(query, user);
  }

  @Permissions('dispensers.create')
  @Post()
  create(@Body() dto: CreateDispenserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dispensers.create(dto, user);
  }

  @Permissions('dispensers.view')
  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dispensers.history(id, user);
  }

  @Permissions('dispensers.view')
  @Get('comodatos/list')
  comodatos(@Query() query: DispensersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dispensers.comodatos(query, user);
  }

  @Permissions('dispensers.update')
  @Post('comodatos')
  createComodato(@Body() dto: CreateDispenserComodatoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dispensers.createComodato(dto, user);
  }

  @Permissions('dispensers.update')
  @Post('comodatos/:id/retire')
  retireComodato(@Param('id') id: string, @Body() dto: RetireDispenserComodatoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dispensers.retireComodato(id, dto, user);
  }

  @Permissions('dispensers.maintenance')
  @Post('maintenance')
  createMaintenance(@Body() dto: CreateDispenserMaintenanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dispensers.createMaintenance(dto, user);
  }

  @Permissions('dispensers.maintenance')
  @Post('maintenance/:id/complete')
  completeMaintenance(@Param('id') id: string, @Body() dto: CompleteDispenserMaintenanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dispensers.completeMaintenance(id, dto, user);
  }
}
