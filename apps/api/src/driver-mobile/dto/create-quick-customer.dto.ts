import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateQuickCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
