import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum MobileDeliveryItemSource {
  ORDER_ITEM = 'ORDER_ITEM',
  ADDITIONAL = 'ADDITIONAL'
}

export class DeliveryItemDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0)
  deliveredQuantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  orderedQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsEnum(MobileDeliveryItemSource)
  source?: MobileDeliveryItemSource;
}
