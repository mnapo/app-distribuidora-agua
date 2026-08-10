import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BillingQueryDto } from './dto/billing-query.dto.js';
import { CreateCashClosingDto } from './dto/create-cash-closing.dto.js';
import { CreateInvoiceFromOrderDto } from './dto/create-invoice-from-order.dto.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { InvoiceItemDto } from './dto/invoice-item.dto.js';
import { pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type CalculatedInvoiceItem = {
  tenantId: string;
  description: string;
  productId?: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  lineTotal: number;
};

@Injectable()
export class BillingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async invoices(query: BillingQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.InvoiceWhereInput = { tenantId, customerId: query.customerId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({ where, include: { customer: true, order: true, items: true, allocations: true }, orderBy: { issuedAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.invoice.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createInvoice(dto: CreateInvoiceDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertCustomer(dto.customerId, tenantId);
    await this.assertOrder(dto.orderId, dto.customerId, tenantId);
    await this.assertRouteOrder(dto.routeOrderId, dto.customerId, tenantId);
    const items = this.calculateItems(dto.items, tenantId);
    const subtotal = this.money(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const taxTotal = this.money(items.reduce((sum, item) => sum + (item.lineTotal * item.tax) / 100, 0));
    const total = this.money(subtotal + taxTotal);
    const number = dto.number?.trim() ?? (await this.nextInvoiceNumber(tenantId));

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          orderId: dto.orderId,
          routeOrderId: dto.routeOrderId,
          number,
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          subtotal,
          taxTotal,
          total,
          balance: total,
          notes: dto.notes?.trim(),
          items: { create: items }
        },
        include: { items: true }
      });
      await this.createAccountMovement(tx, tenantId, dto.customerId, { invoiceId: created.id, orderId: dto.orderId, type: 'INVOICE', debit: total, credit: 0, description: `Factura ${number}` });
      return created;
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'billing.invoices.create', entity: 'Invoice', entityId: invoice.id, newValues: { number, total } });
    return invoice;
  }

  async createInvoiceFromOrder(dto: CreateInvoiceFromOrderDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, tenantId }, include: { items: { include: { product: true } } } });
    if (!order) throw new NotFoundException('Order not found');
    return this.createInvoice(
      {
        customerId: order.customerId,
        orderId: order.id,
        routeOrderId: dto.routeOrderId,
        number: dto.number,
        dueAt: dto.dueAt,
        items: order.items.map((item) => ({
          description: item.product.name,
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          tax: Number(item.product.tax)
        }))
      },
      user
    );
  }

  async payments(query: BillingQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.PaymentWhereInput = { tenantId, customerId: query.customerId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where, include: { customer: true, allocations: { include: { invoice: { include: { order: true } } } } }, orderBy: { paidAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.payment.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createPayment(dto: CreatePaymentDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertCustomer(dto.customerId, tenantId);
    const allocations = dto.allocations ?? (await this.autoAllocations(tenantId, dto.customerId, dto.amount));
    const allocationTotal = this.money(allocations.reduce((sum, item) => sum + item.amount, 0));
    if (allocationTotal > dto.amount) throw new BadRequestException('Allocations cannot exceed payment amount');
    await this.assertInvoices(allocations.map((item) => item.invoiceId), dto.customerId, tenantId);

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          tenantId,
          customerId: dto.customerId,
          amount: dto.amount,
          unappliedAmount: this.money(dto.amount - allocationTotal),
          method: dto.method,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
          reference: dto.reference?.trim(),
          notes: dto.notes?.trim()
        }
      });
      for (const allocation of allocations) {
        await tx.paymentAllocation.create({ data: { tenantId, paymentId: created.id, invoiceId: allocation.invoiceId, amount: allocation.amount } });
        const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: allocation.invoiceId } });
        const paidTotal = this.money(Number(invoice.paidTotal) + allocation.amount);
        const balance = this.money(Number(invoice.total) - paidTotal);
        await tx.invoice.update({ where: { id: allocation.invoiceId }, data: { paidTotal, balance, status: balance <= 0 ? 'PAID' : 'PARTIALLY_PAID' } });
      }
      await this.createAccountMovement(tx, tenantId, dto.customerId, { paymentId: created.id, type: 'PAYMENT', debit: 0, credit: dto.amount, description: `Pago ${created.reference ?? created.id}` });
      return tx.payment.findUniqueOrThrow({ where: { id: created.id }, include: { allocations: true } });
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'billing.payments.create', entity: 'Payment', entityId: payment.id, newValues: { amount: dto.amount } });
    return payment;
  }

  async createAutoAllocatedPayment(dto: Omit<CreatePaymentDto, 'allocations'>, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertCustomer(dto.customerId, tenantId);
    return this.createPayment({ ...dto, allocations: await this.autoAllocations(tenantId, dto.customerId, dto.amount) }, user);
  }

  async applyOpenInvoices(paymentId: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, tenantId } });
    if (!payment) throw new NotFoundException('Payment not found');
    const amountToApply = this.money(Number(payment.unappliedAmount));
    if (amountToApply <= 0) throw new BadRequestException('Payment has no unapplied amount');
    const allocations = await this.autoAllocations(tenantId, payment.customerId, amountToApply);
    if (!allocations.length) throw new BadRequestException('Customer has no open invoices');

    const updated = await this.prisma.$transaction(async (tx) => {
      let applied = 0;
      for (const allocation of allocations) {
        applied = this.money(applied + allocation.amount);
        await tx.paymentAllocation.create({ data: { tenantId, paymentId: payment.id, invoiceId: allocation.invoiceId, amount: allocation.amount } });
        const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: allocation.invoiceId } });
        const paidTotal = this.money(Number(invoice.paidTotal) + allocation.amount);
        const balance = this.money(Number(invoice.total) - paidTotal);
        await tx.invoice.update({ where: { id: allocation.invoiceId }, data: { paidTotal, balance, status: balance <= 0 ? 'PAID' : 'PARTIALLY_PAID' } });
      }
      await tx.payment.update({ where: { id: payment.id }, data: { unappliedAmount: this.money(amountToApply - applied) } });
      return tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { allocations: { include: { invoice: { include: { order: true } } } }, customer: true } });
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'billing.payments.apply_open_invoices', entity: 'Payment', entityId: payment.id, newValues: { applied: amountToApply } });
    return updated;
  }

  private async autoAllocations(tenantId: string, customerId: string, amount: number) {
    const openInvoices = await this.prisma.invoice.findMany({
      where: { tenantId, customerId, balance: { gt: 0 }, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
      orderBy: [{ dueAt: 'asc' }, { issuedAt: 'asc' }]
    });
    let remaining = this.money(amount);
    const allocations = [];
    for (const invoice of openInvoices) {
      if (remaining <= 0) break;
      const amount = this.money(Math.min(remaining, Number(invoice.balance)));
      allocations.push({ invoiceId: invoice.id, amount });
      remaining = this.money(remaining - amount);
    }
    return allocations;
  }

  async accountStatement(customerId: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertCustomer(customerId, tenantId);
    const movements = await this.prisma.accountMovement.findMany({ where: { tenantId, customerId }, orderBy: { createdAt: 'asc' }, include: { invoice: true, payment: true } });
    const balance = movements.at(-1)?.balanceAfter ?? 0;
    return { customerId, balance, movements };
  }

  async overdue(user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const now = new Date();
    return this.prisma.invoice.findMany({ where: { tenantId, dueAt: { lt: now }, balance: { gt: 0 }, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } }, include: { customer: true }, orderBy: { dueAt: 'asc' } });
  }

  async closeCash(dto: CreateCashClosingDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.DeliveryRouteOrderWhereInput = { tenantId, routeId: dto.routeId, stopStatus: 'DELIVERED' };
    const stops = await this.prisma.deliveryRouteOrder.findMany({ where });
    const expectedAmount = this.money(stops.reduce((sum, stop) => sum + Number(stop.collectedAmount), 0));
    const difference = this.money(dto.actualAmount - expectedAmount);
    const closing = await this.prisma.cashClosing.create({ data: { tenantId, routeId: dto.routeId, expectedAmount, actualAmount: dto.actualAmount, difference, notes: dto.notes?.trim() } });
    await this.audit.log({ tenantId, userId: user.id, action: 'billing.cash_closings.create', entity: 'CashClosing', entityId: closing.id, newValues: { expectedAmount, actualAmount: dto.actualAmount } });
    return closing;
  }

  private calculateItems(items: InvoiceItemDto[], tenantId: string): CalculatedInvoiceItem[] {
    if (!items.length) throw new BadRequestException('Invoice requires at least one item');
    return items.map((item) => ({
      tenantId,
      description: item.description.trim(),
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      tax: item.tax ?? 0,
      lineTotal: this.money(item.quantity * item.unitPrice)
    }));
  }

  private async createAccountMovement(
    tx: Prisma.TransactionClient,
    tenantId: string,
    customerId: string,
    input: { invoiceId?: string; paymentId?: string; orderId?: string; type: 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT'; debit: number; credit: number; description: string }
  ): Promise<void> {
    const last = await tx.accountMovement.findFirst({ where: { tenantId, customerId }, orderBy: { createdAt: 'desc' } });
    const balanceAfter = this.money(Number(last?.balanceAfter ?? 0) + input.debit - input.credit);
    await tx.accountMovement.create({ data: { tenantId, customerId, ...input, balanceAfter } });
  }

  private async nextInvoiceNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.invoice.count({ where: { tenantId } });
    return `FAC-${String(count + 1).padStart(8, '0')}`;
  }

  private async assertCustomer(customerId: string, tenantId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new ForbiddenException('Customer does not belong to this tenant');
  }

  private async assertOrder(orderId: string | undefined, customerId: string, tenantId: string): Promise<void> {
    if (!orderId) return;
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId, customerId } });
    if (!order) throw new ForbiddenException('Order does not belong to this customer');
  }

  private async assertRouteOrder(routeOrderId: string | undefined, customerId: string, tenantId: string): Promise<void> {
    if (!routeOrderId) return;
    const routeOrder = await this.prisma.deliveryRouteOrder.findFirst({ where: { id: routeOrderId, tenantId, order: { customerId } } });
    if (!routeOrder) throw new ForbiddenException('Route order does not belong to this customer');
  }

  private async assertInvoices(invoiceIds: string[], customerId: string, tenantId: string): Promise<void> {
    const uniqueIds = [...new Set(invoiceIds)];
    if (!uniqueIds.length) return;
    const count = await this.prisma.invoice.count({ where: { id: { in: uniqueIds }, tenantId, customerId, status: { not: 'VOID' } } });
    if (count !== uniqueIds.length) throw new ForbiddenException('One or more invoices do not belong to this customer');
  }

  private money(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
