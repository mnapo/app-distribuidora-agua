import { ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class ProductsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const search = query.search;
    const where: Prisma.ProductWhereInput = {
      tenantId,
      active: query.active,
      OR: search ? [{ name: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }] : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, include: { category: true }, orderBy: { name: 'asc' }, ...pageArgs(query) }),
      this.prisma.product.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async create(dto: CreateProductDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    await this.assertCategory(dto.categoryId, tenantId);
    const product = await this.prisma.product.create({ data: { ...this.cleanCreate(dto), tenantId } });
    await this.audit.log({ tenantId, userId: user.id, action: 'products.create', entity: 'Product', entityId: product.id, newValues: { sku: product.sku, name: product.name } });
    return product;
  }

  async update(id: string, dto: UpdateProductDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.product.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Product not found');
    await this.assertCategory(dto.categoryId, tenantId);
    const product = await this.prisma.product.update({ where: { id }, data: this.cleanUpdate(dto) });
    await this.audit.log({ tenantId, userId: user.id, action: 'products.update', entity: 'Product', entityId: id, oldValues: { sku: current.sku, active: current.active }, newValues: { sku: product.sku, active: product.active } });
    return product;
  }

  private async assertCategory(categoryId: string | undefined, tenantId: string): Promise<void> {
    if (!categoryId) return;
    const category = await this.prisma.productCategory.findFirst({ where: { id: categoryId, tenantId } });
    if (!category) throw new ForbiddenException('Product category does not belong to this tenant');
  }

  private cleanCreate(dto: CreateProductDto): Omit<Prisma.ProductUncheckedCreateInput, 'tenantId'> {
    return {
      ...dto,
      sku: dto.sku?.trim(),
      barcode: dto.barcode?.trim() || undefined,
      name: dto.name?.trim(),
      unit: dto.unit?.trim()
    };
  }

  private cleanUpdate(dto: UpdateProductDto): Prisma.ProductUncheckedUpdateInput {
    return {
      ...dto,
      sku: dto.sku?.trim(),
      barcode: dto.barcode?.trim() || undefined,
      name: dto.name?.trim(),
      unit: dto.unit?.trim()
    };
  }
}
