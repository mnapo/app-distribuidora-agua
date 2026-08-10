import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class CreateDriverDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  licenseCategory?: string;

  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}
