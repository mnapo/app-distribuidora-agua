import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteDispenserMaintenanceDto {
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  result?: string;
}
