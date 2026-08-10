import { IsNumber, IsString } from 'class-validator';

export class PriceListItemDto {
  @IsString()
  productId!: string;

  @IsNumber()
  price!: number;
}
