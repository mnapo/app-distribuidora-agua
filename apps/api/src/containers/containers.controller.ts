import { Body, Controller, Get, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { ContainersService } from './containers.service.js';
import { CreateContainerMovementDto } from './dto/create-container-movement.dto.js';
import { CreateContainerTypeDto } from './dto/create-container-type.dto.js';
import { ContainersQueryDto } from './dto/containers-query.dto.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('containers')
export class ContainersController {
  constructor(@Inject(ContainersService) private readonly containers: ContainersService) {}

  @Permissions('containers.view')
  @Get('types')
  findTypes(@Query() query: ContainersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.containers.findTypes(query, user);
  }

  @Permissions('containers.create')
  @Post('types')
  createType(@Body() dto: CreateContainerTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.containers.createType(dto, user);
  }

  @Permissions('containers.view')
  @Get('movements')
  movements(@Query() query: ContainersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.containers.findMovements(query, user);
  }

  @Permissions('containers.create_movement')
  @Post('movements')
  createMovement(@Body() dto: CreateContainerMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.containers.createMovement(dto, user);
  }

  @Permissions('containers.view')
  @Get('balances')
  balances(@Query() query: ContainersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.containers.balances(query, user);
  }
}
