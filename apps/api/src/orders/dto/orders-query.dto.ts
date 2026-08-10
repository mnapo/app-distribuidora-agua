import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { ListQueryDto } from '../../commercial/dto/list-query.dto.js';

export class OrdersQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
