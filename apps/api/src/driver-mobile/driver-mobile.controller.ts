import { Body, Controller, Get, Param, Post, UseGuards, Inject} from '@nestjs/common';
import { CompleteStopDto } from './dto/complete-stop.dto.js';
import { CreateMobilePaymentDto } from './dto/create-mobile-payment.dto.js';
import { CreateMobileSaleDto } from './dto/create-mobile-sale.dto.js';
import { CreateQuickCustomerDto } from './dto/create-quick-customer.dto.js';
import { FailStopDto } from './dto/fail-stop.dto.js';
import { SyncOperationsDto } from './dto/sync-operation.dto.js';
import { DriverMobileService } from './driver-mobile.service.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('driver-mobile')
export class DriverMobileController {
  constructor(@Inject(DriverMobileService) private readonly mobile: DriverMobileService) {}

  @Permissions('driver_mobile.view')
  @Get('routes')
  assignedRoutes(@CurrentUser() user: AuthenticatedUser) {
    return this.mobile.assignedRoutes(user);
  }

  @Permissions('driver_mobile.view')
  @Get('routes/:id')
  routeDetail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.mobile.routeDetail(id, user);
  }

  @Permissions('driver_mobile.view')
  @Get('catalog')
  catalog(@CurrentUser() user: AuthenticatedUser) {
    return this.mobile.catalog(user);
  }

  @Permissions('driver_mobile.complete')
  @Post('customers')
  createQuickCustomer(@Body() dto: CreateQuickCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mobile.createQuickCustomer(dto, user);
  }

  @Permissions('driver_mobile.view')
  @Get('customers/:customerId/debt')
  customerDebt(@Param('customerId') customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.mobile.customerDebt(customerId, user);
  }

  @Permissions('driver_mobile.complete')
  @Post('payments')
  createPayment(@Body() dto: CreateMobilePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mobile.createPayment(dto, user);
  }

  @Permissions('driver_mobile.complete')
  @Post('quick-sales')
  createQuickSale(@Body() dto: CreateMobileSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mobile.createQuickSale(dto, user);
  }

  @Permissions('driver_mobile.complete')
  @Post('routes/:routeId/sales')
  createRouteSale(@Param('routeId') routeId: string, @Body() dto: CreateMobileSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mobile.createRouteSale(routeId, dto, user);
  }

  @Permissions('driver_mobile.complete')
  @Post('stops/:routeOrderId/complete')
  completeStop(@Param('routeOrderId') routeOrderId: string, @Body() dto: CompleteStopDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mobile.completeStop(routeOrderId, dto, user);
  }

  @Permissions('driver_mobile.complete')
  @Post('stops/:routeOrderId/fail')
  failStop(@Param('routeOrderId') routeOrderId: string, @Body() dto: FailStopDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mobile.failStop(routeOrderId, dto, user);
  }

  @Permissions('driver_mobile.sync')
  @Post('sync')
  sync(@Body() dto: SyncOperationsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mobile.sync(dto, user);
  }
}
