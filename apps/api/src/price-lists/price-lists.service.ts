import { ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreatePriceListDto } from './dto/create-price-list.dto.js';
import { UpdatePriceListDto } from './dto/update-price-list.dto.js';
import { SetCustomerProductPriceDto } from './dto/set-customer-product-price.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class PriceListsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.PriceListWhereInput = { tenantId, active: query.active, name: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.priceList.findMany({ where, include: { items: { include: { product: true } } }, orderBy: { name: 'asc' }, ...pageArgs(query) }),
      this.prisma.priceList.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async create(dto: CreatePriceListDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertProducts(dto.items?.map((item) => item.productId) ?? [], tenantId);
    const priceList = await this.prisma.priceList.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        active: dto.active,
        isDefault: dto.isDefault,
        items: { create: dto.items?.map((item) => ({ tenantId, productId: item.productId, price: item.price })) ?? [] }
      },
      include: { items: true }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'price_lists.create', entity: 'PriceList', entityId: priceList.id, newValues: { name: priceList.name } });
    return priceList;
  }

  async update(id: string, dto: UpdatePriceListDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.priceList.findFirst({ where: { id, tenantId }, include: { items: true } });
    if (!current) throw new NotFoundException('Price list not found');
    await this.assertProducts(dto.items?.map((item) => item.productId) ?? [], tenantId);
    const priceList = await this.prisma.$transaction(async (tx) => {
      if (dto.items) await tx.priceListItem.deleteMany({ where: { priceListId: id } });
      return tx.priceList.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          active: dto.active,
          isDefault: dto.isDefault,
          items: dto.items ? { create: dto.items.map((item) => ({ tenantId, productId: item.productId, price: item.price })) } : undefined
        },
        include: { items: true }
      });
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'price_lists.update', entity: 'PriceList', entityId: id, oldValues: { name: current.name, itemCount: current.items.length }, newValues: { name: priceList.name, itemCount: priceList.items.length } });
    return priceList;
  }

  async setCustomerProductPrice(dto: SetCustomerProductPriceDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertCustomer(dto.customerId, tenantId);
    await this.assertProducts([dto.productId], tenantId);
    const price = await this.prisma.customerProductPrice.upsert({
      where: { customerId_productId: { customerId: dto.customerId, productId: dto.productId } },
      update: { price: dto.price },
      create: { tenantId, customerId: dto.customerId, productId: dto.productId, price: dto.price }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'customer_product_prices.set', entity: 'CustomerProductPrice', entityId: price.id, newValues: { customerId: dto.customerId, productId: dto.productId, price: dto.price } });
    return price;
  }

  private async assertProducts(productIds: string[], tenantId: string): Promise<void> {
    const uniqueIds = [...new Set(productIds)];
    if (!uniqueIds.length) return;
    const count = await this.prisma.product.count({ where: { id: { in: uniqueIds }, tenantId } });
    if (count !== uniqueIds.length) throw new ForbiddenException('One or more products do not belong to this tenant');
  }

  private async assertCustomer(customerId: string, tenantId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new ForbiddenException('Customer does not belong to this tenant');
  }
}
