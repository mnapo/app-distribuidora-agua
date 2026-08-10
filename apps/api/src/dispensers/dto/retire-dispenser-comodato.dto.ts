import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RetireDispenserComodatoDto {
  @IsOptional()
  @IsDateString()
  returnedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  notes?: string;
}
