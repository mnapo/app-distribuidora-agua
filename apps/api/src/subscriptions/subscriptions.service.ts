import { ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateCustomerSubscriptionDto } from './dto/create-customer-subscription.dto.js';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto.js';
import { RecordSubscriptionUsageDto } from './dto/record-subscription-usage.dto.js';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SubscriptionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async plans(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.SubscriptionPlanWhereInput = { tenantId, active: query.active, name: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.subscriptionPlan.findMany({ where, include: { items: { include: { product: true } } }, orderBy: { name: 'asc' }, ...pageArgs(query) }),
      this.prisma.subscriptionPlan.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createPlan(dto: CreateSubscriptionPlanDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertProducts(dto.items.map((item) => item.productId), tenantId);
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        price: dto.price ?? 0,
        frequency: dto.frequency,
        active: dto.active,
        items: { create: dto.items.map((item) => ({ tenantId, productId: item.productId, includedQuantity: item.includedQuantity })) }
      },
      include: { items: true }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'subscriptions.plans.create', entity: 'SubscriptionPlan', entityId: plan.id, newValues: { name: plan.name } });
    return plan;
  }

  async subscriptions(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customerSubscription.findMany({ where: { tenantId }, include: { customer: true, plan: { include: { items: { include: { product: true } } } } }, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.customerSubscription.count({ where: { tenantId } })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createSubscription(dto: CreateCustomerSubscriptionDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertCustomer(dto.customerId, tenantId);
    await this.assertPlan(dto.planId, tenantId);
    const subscription = await this.prisma.customerSubscription.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        planId: dto.planId,
        currentPeriodStart: new Date(dto.currentPeriodStart),
        currentPeriodEnd: new Date(dto.currentPeriodEnd),
        renewsAt: dto.renewsAt ? new Date(dto.renewsAt) : undefined
      },
      include: { plan: { include: { items: true } } }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'subscriptions.create', entity: 'CustomerSubscription', entityId: subscription.id, newValues: { customerId: dto.customerId } });
    return subscription;
  }

  async recordUsage(dto: RecordSubscriptionUsageDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const subscription = await this.prisma.customerSubscription.findFirst({ where: { id: dto.subscriptionId, tenantId, status: 'ACTIVE' } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    await this.assertProducts([dto.productId], tenantId);
    const usage = await this.prisma.subscriptionUsage.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        productId: dto.productId,
        routeOrderId: dto.routeOrderId,
        quantity: dto.quantity,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd
      }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'subscriptions.usage.record', entity: 'SubscriptionUsage', entityId: usage.id, newValues: { quantity: dto.quantity } });
    return usage;
  }

  async summary(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const subscription = await this.prisma.customerSubscription.findFirst({
      where: { id, tenantId },
      include: { customer: true, plan: { include: { items: { include: { product: true } } } }, usages: true }
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    const rows = subscription.plan.items.map((item) => {
      const used = subscription.usages.filter((usage) => usage.productId === item.productId).reduce((sum, usage) => sum + Number(usage.quantity), 0);
      const included = Number(item.includedQuantity);
      return { product: item.product, included, used, remaining: Math.max(included - used, 0), excess: Math.max(used - included, 0) };
    });
    return { subscription, rows };
  }

  async renew(id: string, dto: RenewSubscriptionDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.customerSubscription.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Subscription not found');
    return this.prisma.customerSubscription.update({
      where: { id },
      data: { status: 'ACTIVE', currentPeriodStart: new Date(dto.currentPeriodStart), currentPeriodEnd: new Date(dto.currentPeriodEnd), renewsAt: new Date(dto.currentPeriodEnd) }
    });
  }

  async suspend(id: string, user: AuthenticatedUser) {
    return this.setStatus(id, 'SUSPENDED', user);
  }

  async cancel(id: string, user: AuthenticatedUser) {
    return this.setStatus(id, 'CANCELLED', user);
  }

  private async setStatus(id: string, status: 'SUSPENDED' | 'CANCELLED', user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.customerSubscription.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Subscription not found');
    return this.prisma.customerSubscription.update({ where: { id }, data: { status } });
  }

  private async assertCustomer(customerId: string, tenantId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId, status: 'ACTIVE' } });
    if (!customer) throw new ForbiddenException('Customer does not belong to this tenant');
  }

  private async assertPlan(planId: string, tenantId: string): Promise<void> {
    const plan = await this.prisma.subscriptionPlan.findFirst({ where: { id: planId, tenantId, active: true } });
    if (!plan) throw new ForbiddenException('Plan does not belong to this tenant');
  }

  private async assertProducts(productIds: string[], tenantId: string): Promise<void> {
    const uniqueIds = [...new Set(productIds)];
    const count = await this.prisma.product.count({ where: { tenantId, id: { in: uniqueIds }, active: true } });
    if (count !== uniqueIds.length) throw new ForbiddenException('One or more products do not belong to this tenant');
  }
}
