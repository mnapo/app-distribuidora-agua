import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { ListQueryDto, pageArgs } from '../commercial/dto/list-query.dto.js';
import { requireTenant } from '../commercial/tenant-scope.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class CustomersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async findAll(query: ListQueryDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const search = query.search;
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      status: query.active === undefined ? undefined : query.active ? 'ACTIVE' : { not: 'ACTIVE' },
      OR: search
        ? [
            { businessName: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { taxId: { contains: search } },
            { phone: { contains: search } }
          ]
        : undefined
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, include: { addresses: true, priceList: true }, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.customer.count({ where })
    ]);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async create(dto: CreateCustomerDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    this.validateName(dto);
    await this.assertPriceList(dto.priceListId, tenantId);
    const customer = await this.prisma.customer.create({
      data: {
        ...this.cleanCreate(dto),
        tenantId,
        addresses: { create: dto.addresses?.map((address) => ({ ...address, tenantId })) ?? [] }
      },
      include: { addresses: true, priceList: true }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'customers.create', entity: 'Customer', entityId: customer.id, newValues: { taxId: customer.taxId, type: customer.type } });
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, user: AuthenticatedUser) {
    const tenantId = requireTenant(user);
    const current = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException('Customer not found');
    await this.assertPriceList(dto.priceListId, tenantId);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...this.cleanUpdate(dto),
        ...(dto.addresses
          ? {
              addresses: {
                deleteMany: {},
                create: dto.addresses.map((address) => ({ ...address, tenantId }))
              }
            }
          : {})
      },
      include: { addresses: true, priceList: true }
    });
    await this.audit.log({ tenantId, userId: user.id, action: 'customers.update', entity: 'Customer', entityId: id, oldValues: { status: current.status }, newValues: { status: customer.status } });
    return customer;
  }

  private validateName(dto: CreateCustomerDto): void {
    if (dto.type === 'COMPANY' && !dto.businessName?.trim()) {
      throw new BadRequestException('businessName is required for company customers');
    }
    if (dto.type === 'PERSON' && (!dto.firstName?.trim() || !dto.lastName?.trim())) {
      throw new BadRequestException('firstName and lastName are required for person customers');
    }
  }

  private async assertPriceList(priceListId: string | null | undefined, tenantId: string): Promise<void> {
    if (!priceListId) return;
    const priceList = await this.prisma.priceList.findFirst({ where: { id: priceListId, tenantId } });
    if (!priceList) throw new ForbiddenException('Price list does not belong to this tenant');
  }

  private cleanCreate(dto: CreateCustomerDto): Omit<Prisma.CustomerUncheckedCreateInput, 'tenantId'> {
    const rest = {
      type: dto.type,
      businessName: dto.businessName,
      firstName: dto.firstName,
      lastName: dto.lastName,
      taxId: dto.taxId,
      phone: dto.phone,
      email: dto.email,
      creditLimit: dto.creditLimit,
      paymentTerms: dto.paymentTerms,
      priceListId: dto.priceListId,
      status: dto.status,
      notes: dto.notes
    };
    return {
      ...rest,
      businessName: rest.businessName?.trim(),
      firstName: rest.firstName?.trim(),
      lastName: rest.lastName?.trim(),
      taxId: rest.taxId?.trim(),
      phone: rest.phone?.trim(),
      email: rest.email?.toLowerCase().trim(),
      creditLimit: rest.creditLimit
    };
  }

  private cleanUpdate(dto: UpdateCustomerDto): Prisma.CustomerUncheckedUpdateInput {
    const rest = {
      type: dto.type,
      businessName: dto.businessName,
      firstName: dto.firstName,
      lastName: dto.lastName,
      taxId: dto.taxId,
      phone: dto.phone,
      email: dto.email,
      creditLimit: dto.creditLimit,
      paymentTerms: dto.paymentTerms,
      priceListId: dto.priceListId,
      status: dto.status,
      notes: dto.notes
    };
    return {
      ...rest,
      businessName: rest.businessName?.trim(),
      firstName: rest.firstName?.trim(),
      lastName: rest.lastName?.trim(),
      taxId: rest.taxId?.trim(),
      phone: rest.phone?.trim(),
      email: rest.email?.toLowerCase().trim(),
      creditLimit: rest.creditLimit
    };
  }
}
