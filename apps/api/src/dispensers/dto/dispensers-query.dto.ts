import { IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../commercial/dto/list-query.dto.js';

export class DispensersQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
