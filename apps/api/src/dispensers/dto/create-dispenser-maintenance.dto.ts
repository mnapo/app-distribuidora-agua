import { DispenserMaintenanceType } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDispenserMaintenanceDto {
  @IsString()
  dispenserId!: string;

  @IsEnum(DispenserMaintenanceType)
  type!: DispenserMaintenanceType;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  notes?: string;
}
