import { Injectable, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportsQueryDto } from './dto/reports-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async kpis(query: ReportsQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const range = this.range(query);
    const [invoiceAgg, paymentAgg, debtAgg, customers, activeCustomers, routes, deliveredStops, products, containerBalances, dispensers, litersAgg, topProducts] = await this.prisma.$transaction([
      this.prisma.invoice.aggregate({ where: { tenantId, issuedAt: range }, _sum: { total: true }, _count: true }),
      this.prisma.payment.aggregate({ where: { tenantId, paidAt: range, status: 'APPLIED' }, _sum: { amount: true }, _count: true }),
      this.prisma.invoice.aggregate({ where: { tenantId, balance: { gt: 0 }, status: { in: ['ISSUED', 'PARTIALLY_PAID'] } }, _sum: { balance: true } }),
      this.prisma.customer.count({ where: { tenantId } }),
      this.prisma.customer.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.deliveryRoute.count({ where: { tenantId, routeDate: range } }),
      this.prisma.deliveryRouteOrder.count({ where: { tenantId, stopStatus: 'DELIVERED', route: { routeDate: range } } }),
      this.prisma.product.count({ where: { tenantId, active: true } }),
      this.prisma.customerContainerBalance.aggregate({ where: { tenantId }, _sum: { balance: true } }),
      this.prisma.dispenser.groupBy({ by: ['status'], where: { tenantId }, _count: true, orderBy: { status: 'asc' } }),
      this.prisma.deliveryStopItem.aggregate({ where: { tenantId, routeOrder: { route: { routeDate: range } }, product: { unit: { contains: 'litro' } } }, _sum: { deliveredQuantity: true } }),
      this.prisma.invoiceItem.groupBy({ by: ['productId'], where: { tenantId, invoice: { issuedAt: range }, productId: { not: null } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { lineTotal: 'desc' } }, take: 10 })
    ]);
    const productNames = await this.prisma.product.findMany({ where: { id: { in: topProducts.map((item) => item.productId).filter((id): id is string => Boolean(id)) }, tenantId }, select: { id: true, name: true } });
    const nameById = new Map(productNames.map((product) => [product.id, product.name]));

    return {
      range: { from: range?.gte ?? null, to: range?.lte ?? null },
      sales: { amount: Number(invoiceAgg._sum.total ?? 0), invoices: invoiceAgg._count },
      collections: { amount: Number(paymentAgg._sum.amount ?? 0), payments: paymentAgg._count },
      debt: { amount: Number(debtAgg._sum.balance ?? 0) },
      customers: { total: customers, active: activeCustomers },
      routes: { total: routes, deliveredStops },
      products: { active: products, top: topProducts.map((item) => ({ productId: item.productId, name: item.productId ? nameById.get(item.productId) ?? item.productId : 'Sin producto', quantity: Number(item._sum?.quantity ?? 0), amount: Number(item._sum?.lineTotal ?? 0) })) },
      containers: { balance: Number(containerBalances._sum.balance ?? 0) },
      dispensers: Object.fromEntries(dispensers.map((item) => [item.status, item._count])),
      liters: { delivered: Number(litersAgg._sum.deliveredQuantity ?? 0) }
    };
  }

  async export(query: ReportsQueryDto, user: AuthenticatedUser) {
    const kpis = await this.kpis(query, user);
    const rows = [
      ['Indicador', 'Valor'],
      ['Ventas', kpis.sales.amount],
      ['Facturas', kpis.sales.invoices],
      ['Cobranzas', kpis.collections.amount],
      ['Pagos', kpis.collections.payments],
      ['Deuda', kpis.debt.amount],
      ['Clientes activos', kpis.customers.active],
      ['Rutas', kpis.routes.total],
      ['Paradas entregadas', kpis.routes.deliveredStops],
      ['Productos activos', kpis.products.active],
      ['Envases en clientes', kpis.containers.balance],
      ['Litros entregados', kpis.liters.delivered]
    ];
    return {
      filename: `kpis-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: 'text/csv',
      content: rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    };
  }

  private range(query: ReportsQueryDto): Prisma.DateTimeFilter | undefined {
    if (!query.from && !query.to) return undefined;
    return {
      gte: query.from ? new Date(query.from) : undefined,
      lte: query.to ? new Date(query.to) : undefined
    };
  }
}
