import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { BranchesService } from './branches.service.js';
import { CreateBranchDto } from './dto/create-branch.dto.js';
import { UpdateBranchDto } from './dto/update-branch.dto.js';
import { ListQueryDto } from '../commercial/dto/list-query.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('branches')
export class BranchesController {
  constructor(@Inject(BranchesService) private readonly branches: BranchesService) {}

  @Permissions('branches.view')
  @Get()
  findAll(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.branches.findAll(query, user);
  }

  @Permissions('branches.create')
  @Post()
  create(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.branches.create(dto, user);
  }

  @Permissions('branches.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.branches.update(id, dto, user);
  }
}
