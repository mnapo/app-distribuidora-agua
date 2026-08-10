import { IsDateString } from 'class-validator';

export class GenerateRecurringOrdersDto {
  @IsDateString()
  until!: string;
}
