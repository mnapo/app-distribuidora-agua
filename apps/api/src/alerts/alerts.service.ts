import { Injectable, NotFoundException, Inject} from '@nestjs/common';
import { AlertRule, AlertSeverity, AlertType, NotificationChannel, Prisma } from '@prisma/client';
import { AlertsQueryDto } from './dto/alerts-query.dto.js';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto.js';
import { CreateManualAlertDto } from './dto/create-manual-alert.dto.js';
import { pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type AlertCandidate = {
  rule: AlertRule;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  dueAt?: Date;
};

@Injectable()
export class AlertsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async rules(query: AlertsQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.AlertRuleWhereInput = { tenantId, active: query.active, type: this.typeFilter(query.type), name: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.alertRule.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(query) }),
      this.prisma.alertRule.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createRule(dto: CreateAlertRuleDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const rule = await this.prisma.alertRule.create({
      data: {
        tenantId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        type: dto.type,
        severity: dto.severity,
        channel: dto.channel,
        thresholdDays: dto.thresholdDays,
        active: dto.active
      }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'alerts.rules.create', entity: 'AlertRule', entityId: rule.id, newValues: { code: rule.code, type: rule.type } });
    return rule;
  }

  async findAll(query: AlertsQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.AlertWhereInput = { tenantId, status: this.statusFilter(query.status), type: this.typeFilter(query.type), title: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.alert.findMany({ where, include: { rule: true, notifications: true }, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.alert.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async createManual(dto: CreateManualAlertDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const alert = await this.createAlertWithNotification(tenantId, {
      rule: {
        id: undefined,
        tenantId,
        type: dto.type,
        severity: dto.severity ?? 'MEDIUM',
        channel: dto.channel ?? 'IN_APP'
      } as unknown as AlertRule,
      title: dto.title.trim(),
      message: dto.message.trim(),
      entityType: dto.entityType ?? 'ManualAlert',
      entityId: dto.entityId ?? `manual-${Date.now()}`
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'alerts.create_manual', entity: 'Alert', entityId: alert.id, newValues: { title: alert.title } });
    return alert;
  }

  async acknowledge(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertAlert(id, tenantId);
    return this.prisma.alert.update({ where: { id }, data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() } });
  }

  async resolve(id: string, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertAlert(id, tenantId);
    return this.prisma.alert.update({ where: { id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
  }

  async scan(user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const rules = await this.ensureDefaultRules(tenantId);
    const candidates = [
      ...(await this.overdueInvoices(tenantId, rules)),
      ...(await this.inactiveCustomers(tenantId, rules)),
      ...(await this.subscriptionRenewals(tenantId, rules)),
      ...(await this.dispenserMaintenances(tenantId, rules))
    ];
    const alerts = [];
    for (const candidate of candidates) {
      alerts.push(await this.createAlertWithNotification(tenantId, candidate));
    }
    await this.prisma.scheduledTask.upsert({
      where: { tenantId_code: { tenantId, code: 'alerts.scan' } },
      update: { type: 'ALERT_SCAN', status: 'IDLE', lastRunAt: new Date(), error: null },
      create: { tenantId, code: 'alerts.scan', type: 'ALERT_SCAN', status: 'IDLE', lastRunAt: new Date() }
    });
    return { scanned: candidates.length, alerts };
  }

  async notifications(query: AlertsQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.NotificationWhereInput = { tenantId, status: query.status ? (query.status as never) : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, include: { alert: true }, orderBy: { scheduledAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.notification.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async dispatch(user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const pending = await this.prisma.notification.findMany({ where: { tenantId, status: 'PENDING', scheduledAt: { lte: new Date() } }, take: 50, orderBy: { scheduledAt: 'asc' } });
    const activeIntegrations = await this.prisma.externalIntegration.findMany({ where: { tenantId, status: 'ACTIVE' } });
    const activeProviders = new Set(activeIntegrations.map((integration) => integration.provider));
    const results = [];
    for (const notification of pending) {
      const canSend = notification.channel === 'IN_APP' || notification.channel === 'WEBHOOK' || (notification.channel === 'EMAIL' && activeProviders.has('WEBHOOK')) || (notification.channel === 'WHATSAPP' && activeProviders.has('WHATSAPP_BUSINESS'));
      results.push(
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: canSend
            ? { status: 'SENT', sentAt: new Date(), error: null }
            : { status: 'SKIPPED', error: `No active provider configured for ${notification.channel}` }
        })
      );
    }
    await this.prisma.scheduledTask.upsert({
      where: { tenantId_code: { tenantId, code: 'notifications.dispatch' } },
      update: { type: 'NOTIFICATION_DISPATCH', status: 'IDLE', lastRunAt: new Date(), error: null },
      create: { tenantId, code: 'notifications.dispatch', type: 'NOTIFICATION_DISPATCH', status: 'IDLE', lastRunAt: new Date() }
    });
    return { processed: results.length, notifications: results };
  }

  private async ensureDefaultRules(tenantId: string): Promise<AlertRule[]> {
    const defaults: Array<{ code: string; name: string; type: AlertType; severity: AlertSeverity; channel: NotificationChannel; thresholdDays: number }> = [
      { code: 'overdue-invoices', name: 'Facturas vencidas', type: 'OVERDUE_INVOICE', severity: 'HIGH', channel: 'IN_APP', thresholdDays: 0 },
      { code: 'inactive-customers', name: 'Clientes inactivos', type: 'INACTIVE_CUSTOMER', severity: 'MEDIUM', channel: 'IN_APP', thresholdDays: 30 },
      { code: 'subscription-renewals', name: 'Renovacion de abonos', type: 'SUBSCRIPTION_RENEWAL', severity: 'MEDIUM', channel: 'IN_APP', thresholdDays: 7 },
      { code: 'dispenser-maintenance', name: 'Mantenimiento de dispensers', type: 'DISPENSER_MAINTENANCE', severity: 'HIGH', channel: 'IN_APP', thresholdDays: 0 }
    ];
    for (const rule of defaults) {
      await this.prisma.alertRule.upsert({
        where: { tenantId_code: { tenantId, code: rule.code } },
        update: {},
        create: { tenantId, ...rule }
      });
    }
    return this.prisma.alertRule.findMany({ where: { tenantId, active: true } });
  }

  private async overdueInvoices(tenantId: string, rules: AlertRule[]): Promise<AlertCandidate[]> {
    const rule = rules.find((item) => item.type === 'OVERDUE_INVOICE');
    if (!rule) return [];
    const invoices = await this.prisma.invoice.findMany({ where: { tenantId, dueAt: { lt: new Date() }, balance: { gt: 0 }, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } }, include: { customer: true }, take: 100 });
    return invoices.map((invoice) => ({
      rule,
      title: `Factura vencida ${invoice.number}`,
      message: `Saldo pendiente ${invoice.balance}`,
      entityType: 'Invoice',
      entityId: invoice.id,
      dueAt: invoice.dueAt ?? undefined
    }));
  }

  private async inactiveCustomers(tenantId: string, rules: AlertRule[]): Promise<AlertCandidate[]> {
    const rule = rules.find((item) => item.type === 'INACTIVE_CUSTOMER');
    if (!rule) return [];
    const cutoff = new Date(Date.now() - (rule.thresholdDays ?? 30) * 24 * 60 * 60 * 1000);
    const customers = await this.prisma.customer.findMany({ where: { tenantId, status: 'ACTIVE', orders: { none: { createdAt: { gte: cutoff } } } }, take: 100 });
    return customers.map((customer) => ({
      rule,
      title: 'Cliente inactivo',
      message: customer.businessName ?? (`${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || customer.id),
      entityType: 'Customer',
      entityId: customer.id
    }));
  }

  private async subscriptionRenewals(tenantId: string, rules: AlertRule[]): Promise<AlertCandidate[]> {
    const rule = rules.find((item) => item.type === 'SUBSCRIPTION_RENEWAL');
    if (!rule) return [];
    const until = new Date(Date.now() + (rule.thresholdDays ?? 7) * 24 * 60 * 60 * 1000);
    const subscriptions = await this.prisma.customerSubscription.findMany({ where: { tenantId, status: 'ACTIVE', renewsAt: { lte: until } }, include: { customer: true, plan: true }, take: 100 });
    return subscriptions.map((subscription) => ({
      rule,
      title: `Abono por renovar ${subscription.plan.name}`,
      message: subscription.customer.businessName ?? (`${subscription.customer.firstName ?? ''} ${subscription.customer.lastName ?? ''}`.trim() || subscription.customerId),
      entityType: 'CustomerSubscription',
      entityId: subscription.id,
      dueAt: subscription.renewsAt ?? undefined
    }));
  }

  private async dispenserMaintenances(tenantId: string, rules: AlertRule[]): Promise<AlertCandidate[]> {
    const rule = rules.find((item) => item.type === 'DISPENSER_MAINTENANCE');
    if (!rule) return [];
    const maintenances = await this.prisma.dispenserMaintenance.findMany({ where: { tenantId, status: { in: ['SCHEDULED', 'IN_PROGRESS'] }, scheduledAt: { lte: new Date() } }, include: { dispenser: true }, take: 100 });
    return maintenances.map((maintenance) => ({
      rule,
      title: `Mantenimiento pendiente ${maintenance.dispenser.serialNumber}`,
      message: maintenance.notes ?? maintenance.type,
      entityType: 'DispenserMaintenance',
      entityId: maintenance.id,
      dueAt: maintenance.scheduledAt
    }));
  }

  private async createAlertWithNotification(tenantId: string, candidate: AlertCandidate) {
    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.alert.upsert({
        where: { tenantId_type_entityType_entityId: { tenantId, type: candidate.rule.type, entityType: candidate.entityType, entityId: candidate.entityId } },
        update: { status: 'OPEN', title: candidate.title, message: candidate.message, dueAt: candidate.dueAt },
        create: {
          tenantId,
          ruleId: candidate.rule.id,
          type: candidate.rule.type,
          severity: candidate.rule.severity,
          title: candidate.title,
          message: candidate.message,
          entityType: candidate.entityType,
          entityId: candidate.entityId,
          dueAt: candidate.dueAt
        }
      });
      const existing = await tx.notification.findFirst({ where: { tenantId, alertId: alert.id, status: 'PENDING' } });
      if (!existing) {
        await tx.notification.create({ data: { tenantId, alertId: alert.id, channel: candidate.rule.channel, subject: candidate.title, body: candidate.message } });
      }
      return alert;
    });
  }

  private async assertAlert(id: string, tenantId: string): Promise<void> {
    const alert = await this.prisma.alert.findFirst({ where: { id, tenantId } });
    if (!alert) throw new NotFoundException('Alert not found');
  }

  private typeFilter(type: string | undefined): AlertType | undefined {
    return Object.values(AlertType).includes(type as AlertType) ? (type as AlertType) : undefined;
  }

  private statusFilter(status: string | undefined) {
    if (!status) return undefined;
    return status === 'OPEN' || status === 'ACKNOWLEDGED' || status === 'RESOLVED' || status === 'DISMISSED' ? status : undefined;
  }
}
