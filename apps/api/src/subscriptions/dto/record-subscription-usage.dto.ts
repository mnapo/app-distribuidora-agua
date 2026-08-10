import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordSubscriptionUsageDto {
  @IsString()
  subscriptionId!: string;

  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  routeOrderId?: string;
}
