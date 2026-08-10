import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { OrderItemDto } from '../../orders/dto/order-item.dto.js';

export class CreateMobileSaleDto {
  @IsString()
  customerId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  collectedAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  deliveryNotes?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
