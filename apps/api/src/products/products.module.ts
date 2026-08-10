import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductCategoriesController } from './product-categories.controller.js';
import { ProductsService } from './products.service.js';
import { ProductCategoriesService } from './product-categories.service.js';

@Module({
  controllers: [ProductsController, ProductCategoriesController],
  providers: [ProductsService, ProductCategoriesService],
  exports: [ProductsService, ProductCategoriesService]
})
export class ProductsModule {}
