import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Inject} from '@nestjs/common';
import { PriceListsService } from './price-lists.service.js';
import { CreatePriceListDto } from './dto/create-price-list.dto.js';
import { UpdatePriceListDto } from './dto/update-price-list.dto.js';
import { SetCustomerProductPriceDto } from './dto/set-customer-product-price.dto.js';
import { ListQueryDto } from '../commercial/dto/list-query.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../common/guards/permissions.guard.js';
import { Permissions } from '../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../common/authenticated-user.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('price-lists')
export class PriceListsController {
  constructor(@Inject(PriceListsService) private readonly priceLists: PriceListsService) {}

  @Permissions('price_lists.view')
  @Get()
  findAll(@Query() query: ListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.priceLists.findAll(query, user);
  }

  @Permissions('price_lists.create')
  @Post()
  create(@Body() dto: CreatePriceListDto, @CurrentUser() user: AuthenticatedUser) {
    return this.priceLists.create(dto, user);
  }

  @Permissions('price_lists.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePriceListDto, @CurrentUser() user: AuthenticatedUser) {
    return this.priceLists.update(id, dto, user);
  }

  @Permissions('price_lists.update')
  @Post('customer-product-prices')
  setCustomerProductPrice(@Body() dto: SetCustomerProductPriceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.priceLists.setCustomerProductPrice(dto, user);
  }
}
