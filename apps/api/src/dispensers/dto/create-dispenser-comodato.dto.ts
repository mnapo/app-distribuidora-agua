import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDispenserComodatoDto {
  @IsString()
  dispenserId!: string;

  @IsString()
  customerId!: string;

  @IsOptional()
  @IsDateString()
  deliveredAt?: string;

  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  notes?: string;
}
