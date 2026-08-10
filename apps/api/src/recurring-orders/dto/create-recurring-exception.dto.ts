import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateRecurringExceptionDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
