import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateCustomerSubscriptionDto {
  @IsString()
  customerId!: string;

  @IsString()
  planId!: string;

  @IsDateString()
  currentPeriodStart!: string;

  @IsDateString()
  currentPeriodEnd!: string;

  @IsOptional()
  @IsDateString()
  renewsAt?: string;
}
