import { Body, Controller, Get, Param, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { BillingQueryDto } from './dto/billing-query.dto.js';
import { CreateCashClosingDto } from './dto/create-cash-closing.dto.js';
import { CreateInvoiceFromOrderDto } from './dto/create-invoice-from-order.dto.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('billing')
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  @Permissions('billing.view')
  @Get('invoices')
  invoices(@Query() query: BillingQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.invoices(query, user);
  }

  @Permissions('billing.create_invoice')
  @Post('invoices')
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.createInvoice(dto, user);
  }

  @Permissions('billing.create_invoice')
  @Post('invoices/from-order')
  createInvoiceFromOrder(@Body() dto: CreateInvoiceFromOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.createInvoiceFromOrder(dto, user);
  }

  @Permissions('billing.view')
  @Get('payments')
  payments(@Query() query: BillingQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.payments(query, user);
  }

  @Permissions('billing.create_payment')
  @Post('payments')
  createPayment(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.createPayment(dto, user);
  }

  @Permissions('billing.create_payment')
  @Post('payments/:id/apply-open-invoices')
  applyOpenInvoices(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.applyOpenInvoices(id, user);
  }

  @Permissions('billing.view')
  @Get('account-statement/:customerId')
  accountStatement(@Param('customerId') customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.accountStatement(customerId, user);
  }

  @Permissions('billing.view')
  @Get('overdue')
  overdue(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.overdue(user);
  }

  @Permissions('billing.cash_closing')
  @Post('cash-closings')
  closeCash(@Body() dto: CreateCashClosingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.closeCash(dto, user);
  }
}
