import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { ProductCategoriesService } from './product-categories.service.js';
import { CreateProductCategoryDto } from './dto/create-product-category.dto.js';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto.js';
import { ListQueryDto } from '../commercial/dto/list-query.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('product-categories')
export class ProductCategoriesController {
  constructor(@Inject(ProductCategoriesService) private readonly categories: ProductCategoriesService) {}

  @Permissions('products.view')
  @Get()
  findAll(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categories.findAll(query, user);
  }

  @Permissions('products.create')
  @Post()
  create(@Body() dto: CreateProductCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categories.create(dto, user);
  }

  @Permissions('products.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categories.update(id, dto, user);
  }
}
