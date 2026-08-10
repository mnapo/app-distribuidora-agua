import { Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProductCategoryDto } from './dto/create-product-category.dto.js';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class ProductCategoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async findAll(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const where: Prisma.ProductCategoryWhereInput = { tenantId, active: query.active, name: query.search ? { contains: query.search } : undefined };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.productCategory.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(query) }),
      this.prisma.productCategory.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async create(dto: CreateProductCategoryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const category = await this.prisma.productCategory.create({ data: { tenantId, name: dto.name.trim(), active: dto.active } });
    await this.audit.log({ tenantId, userId: user.id, action: 'product_categories.create', entity: 'ProductCategory', entityId: category.id, newValues: { name: category.name } });
    return category;
  }

  async update(id: string, dto: UpdateProductCategoryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.productCategory.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Product category not found');
    const category = await this.prisma.productCategory.update({ where: { id }, data: { name: dto.name?.trim(), active: dto.active } });
    await this.audit.log({ tenantId, userId: user.id, action: 'product_categories.update', entity: 'ProductCategory', entityId: id, oldValues: { name: current.name, active: current.active }, newValues: { name: category.name, active: category.active } });
    return category;
  }
}
