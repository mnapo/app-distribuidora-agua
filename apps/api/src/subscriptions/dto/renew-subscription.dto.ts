import { IsDateString } from 'class-validator';

export class RenewSubscriptionDto {
  @IsDateString()
  currentPeriodStart!: string;

  @IsDateString()
  currentPeriodEnd!: string;
}
