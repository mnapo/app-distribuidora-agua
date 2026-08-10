import { Controller, Get, UseGuards, Inject} from '@nestjs/common';
import { PermissionsService } from './permissions.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(@Inject(PermissionsService) private readonly permissionsService: PermissionsService) {}

  @Permissions('roles.view')
  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }
}
