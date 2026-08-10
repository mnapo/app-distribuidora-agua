import { IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../commercial/dto/list-query.dto.js';

export class BillingQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  customerId?: string;
}
