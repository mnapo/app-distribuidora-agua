import { IsNumber, IsString, Min } from 'class-validator';

export class SubscriptionPlanItemDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0.001)
  includedQuantity!: number;
}
