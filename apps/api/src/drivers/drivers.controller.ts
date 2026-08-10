import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { DriversService } from './drivers.service.js';
import { CreateDriverDto } from './dto/create-driver.dto.js';
import { UpdateDriverDto } from './dto/update-driver.dto.js';
import { ListQueryDto } from '../commercial/dto/list-query.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('drivers')
export class DriversController {
  constructor(@Inject(DriversService) private readonly drivers: DriversService) {}

  @Permissions('drivers.view')
  @Get()
  findAll(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.drivers.findAll(query, user);
  }

  @Permissions('drivers.create')
  @Post()
  create(@Body() dto: CreateDriverDto, @CurrentUser() user: AuthenticatedUser) {
    return this.drivers.create(dto, user);
  }

  @Permissions('drivers.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto, @CurrentUser() user: AuthenticatedUser) {
    return this.drivers.update(id, dto, user);
  }
}
