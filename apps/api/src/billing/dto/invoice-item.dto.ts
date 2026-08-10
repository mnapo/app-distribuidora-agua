import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class InvoiceItemDto {
  @IsString()
  @MaxLength(191)
  description!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;
}
