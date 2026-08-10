import { Controller, Get, Query, UseGuards, Inject} from '@nestjs/common';
import { ReportsQueryDto } from './dto/reports-query.dto.js';
import { ReportsService } from './reports.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Permissions('reports.view')
  @Get('kpis')
  kpis(@Query() query: ReportsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reports.kpis(query, user);
  }

  @Permissions('reports.export')
  @Get('export')
  export(@Query() query: ReportsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reports.export(query, user);
  }
}
