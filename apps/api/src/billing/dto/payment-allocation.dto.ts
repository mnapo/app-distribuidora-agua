import { IsNumber, IsString, Min } from 'class-validator';

export class PaymentAllocationDto {
  @IsString()
  invoiceId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}
