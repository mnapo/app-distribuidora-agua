import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCashClosingDto {
  @IsOptional()
  @IsString()
  routeId?: string;

  @IsNumber()
  @Min(0)
  actualAmount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
