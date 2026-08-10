import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDispenserDto {
  @IsString()
  modelId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  serialNumber!: string;

  @IsOptional()
  @IsDateString()
  acquiredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  notes?: string;
}
