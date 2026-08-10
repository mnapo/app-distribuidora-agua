import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma, RecurrenceFrequency } from '@prisma/client';
import { CreateRecurringExceptionDto } from './dto/create-recurring-exception.dto.js';
import { CreateRecurringOrderRuleDto } from './dto/create-recurring-order-rule.dto.js';
import { GenerateRecurringOrdersDto } from './dto/generate-recurring-orders.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RecurringOrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.RecurringOrderRuleWhereInput = { tenantId, name: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.recurringOrderRule.findMany({ where, include: { customer: true, items: { include: { product: true } }, exceptions: true }, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.recurringOrderRule.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async create(dto: CreateRecurringOrderRuleDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    if (!dto.items.length) throw new BadRequestException('Recurring rule requires at least one item');
    await this.assertCustomer(dto.customerId, tenantId);
    await this.assertAddress(dto.deliveryAddressId, dto.customerId, tenantId);
    await this.assertProducts(dto.items.map((item) => item.productId), tenantId);
    const startDate = this.startOfDay(new Date(dto.startDate));
    const rule = await this.prisma.recurringOrderRule.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        name: dto.name.trim(),
        frequency: dto.frequency,
        interval: dto.interval ?? 1,
        daysOfWeek: dto.daysOfWeek?.trim(),
        dayOfMonth: dto.dayOfMonth,
        startDate,
        endDate: dto.endDate ? this.startOfDay(new Date(dto.endDate)) : undefined,
        nextRunDate: startDate,
        deliveryAddressId: dto.deliveryAddressId,
        notes: dto.notes?.trim(),
        items: { create: dto.items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount ?? 0 })) }
      },
      include: { items: true }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'recurring_orders.rules.create', entity: 'RecurringOrderRule', entityId: rule.id, newValues: { name: rule.name } });
    return rule;
  }

  async suspend(id: string, user: AuthenticatedUser) {
    return this.setStatus(id, 'SUSPENDED', user);
  }

  async activate(id: string, user: AuthenticatedUser) {
    return this.setStatus(id, 'ACTIVE', user);
  }

  async createException(id: string, dto: CreateRecurringExceptionDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const rule = await this.prisma.recurringOrderRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException('Recurring rule not found');
    return this.prisma.recurringOrderException.create({
      data: { tenantId, ruleId: id, customerId: rule.customerId, date: this.startOfDay(new Date(dto.date)), reason: dto.reason?.trim() }
    });
  }

  async generate(dto: GenerateRecurringOrdersDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const until = this.startOfDay(new Date(dto.until));
    const rules = await this.prisma.recurringOrderRule.findMany({
      where: { tenantId, status: 'ACTIVE', nextRunDate: { lte: until } },
      include: { items: { include: { product: true } }, exceptions: true, customer: true }
    });
    const generated = [];
    for (const rule of rules) {
      const dates = this.datesForRule(rule, until);
      for (const targetDate of dates) {
        if (rule.exceptions.some((exception) => this.sameDay(exception.date, targetDate))) continue;
        const existing = await this.prisma.recurringOrderGenerated.findUnique({ where: { ruleId_targetDate: { ruleId: rule.id, targetDate } } });
        if (existing) continue;
        const order = await this.prisma.$transaction(async (tx) => {
          const created = await tx.order.create({
            data: {
              tenantId,
              customerId: rule.customerId,
              deliveryAddressId: rule.deliveryAddressId,
              requestedDeliveryAt: targetDate,
              notes: `Generado por regla recurrente ${rule.name}`,
              subtotal: this.money(rule.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice ?? item.product.price), 0)),
              discountTotal: this.money(rule.items.reduce((sum, item) => sum + Number(item.discount), 0)),
              total: this.money(rule.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice ?? item.product.price) - Number(item.discount), 0)),
              items: {
                create: rule.items.map((item) => {
                  const unitPrice = Number(item.unitPrice ?? item.product.price);
                  const lineSubtotal = this.money(Number(item.quantity) * unitPrice);
                  const discount = Number(item.discount);
                  return { tenantId, productId: item.productId, quantity: item.quantity, unitPrice, discount, lineSubtotal, lineTotal: this.money(lineSubtotal - discount) };
                })
              }
            }
          });
          await tx.recurringOrderGenerated.create({ data: { ruleId: rule.id, orderId: created.id, targetDate } });
          return created;
        });
        generated.push(order);
      }
      const next = this.nextDate(rule.frequency, dates.at(-1) ?? rule.nextRunDate ?? rule.startDate, rule.interval);
      await this.prisma.recurringOrderRule.update({ where: { id: rule.id }, data: { nextRunDate: next } });
    }
    await this.audit.log({ tenantId, userId: user.id, action: 'recurring_orders.generate', entity: 'RecurringOrderRule', newValues: { generated: generated.length } });
    return { generated };
  }

  private async setStatus(id: string, status: 'ACTIVE' | 'SUSPENDED', user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const rule = await this.prisma.recurringOrderRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException('Recurring rule not found');
    return this.prisma.recurringOrderRule.update({ where: { id }, data: { status } });
  }

  private datesForRule(rule: { frequency: RecurrenceFrequency; interval: number; startDate: Date; endDate: Date | null; nextRunDate: Date | null; daysOfWeek: string | null; dayOfMonth: number | null }, until: Date): Date[] {
    const dates: Date[] = [];
    let cursor = this.startOfDay(rule.nextRunDate ?? rule.startDate);
    while (cursor <= until && (!rule.endDate || cursor <= rule.endDate)) {
      if (this.matchesRule(rule, cursor)) dates.push(new Date(cursor));
      cursor = this.nextDate(rule.frequency, cursor, rule.interval);
    }
    return dates;
  }

  private matchesRule(rule: { frequency: RecurrenceFrequency; daysOfWeek: string | null; dayOfMonth: number | null }, date: Date): boolean {
    if (rule.frequency === 'WEEKLY' && rule.daysOfWeek) return rule.daysOfWeek.split(',').map((day) => Number(day.trim())).includes(date.getDay());
    if (rule.frequency === 'MONTHLY' && rule.dayOfMonth) return date.getDate() === rule.dayOfMonth;
    return true;
  }

  private nextDate(frequency: RecurrenceFrequency, date: Date, interval: number): Date {
    const next = new Date(date);
    if (frequency === 'DAILY') next.setDate(next.getDate() + interval);
    if (frequency === 'WEEKLY') next.setDate(next.getDate() + interval * 7);
    if (frequency === 'MONTHLY') next.setMonth(next.getMonth() + interval);
    return this.startOfDay(next);
  }

  private async assertCustomer(customerId: string, tenantId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId, status: 'ACTIVE' } });
    if (!customer) throw new ForbiddenException('Customer does not belong to this tenant');
  }

  private async assertAddress(addressId: string | undefined, customerId: string, tenantId: string): Promise<void> {
    if (!addressId) return;
    const address = await this.prisma.customerAddress.findFirst({ where: { id: addressId, tenantId, customerId } });
    if (!address) throw new ForbiddenException('Address does not belong to this customer');
  }

  private async assertProducts(productIds: string[], tenantId: string): Promise<void> {
    const uniqueIds = [...new Set(productIds)];
    const count = await this.prisma.product.count({ where: { tenantId, id: { in: uniqueIds }, active: true } });
    if (count !== uniqueIds.length) throw new ForbiddenException('One or more products do not belong to this tenant');
  }

  private startOfDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private sameDay(a: Date, b: Date): boolean {
    return this.startOfDay(a).getTime() === this.startOfDay(b).getTime();
  }

  private money(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
