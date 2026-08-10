import { IsEnum, IsOptional } from 'class-validator';
import { DeliveryRouteStatus } from '@prisma/client';
import { ListQueryDto } from '../../commercial/dto/list-query.dto.js';

export class DeliveryRoutesQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(DeliveryRouteStatus)
  status?: DeliveryRouteStatus;
}
