import { IsNumber, IsString } from 'class-validator';

export class SetCustomerProductPriceDto {
  @IsString()
  customerId!: string;

  @IsString()
  productId!: string;

  @IsNumber()
  price!: number;
}
