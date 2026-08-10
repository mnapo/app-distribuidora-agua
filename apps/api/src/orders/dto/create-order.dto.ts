import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { OrderItemDto } from './order-item.dto.js';

export class CreateOrderDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  deliveryAddressId?: string;

  @IsOptional()
  @IsDateString()
  requestedDeliveryAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  deliveryStreet?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  deliveryCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  deliveryProvince?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  deliveryPostalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  deliveryReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  deliveryNotes?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
