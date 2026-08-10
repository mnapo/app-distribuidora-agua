import { IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../commercial/dto/list-query.dto.js';

export class AlertsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
