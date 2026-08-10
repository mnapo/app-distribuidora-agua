import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInvoiceFromOrderDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsString()
  routeOrderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  number?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
