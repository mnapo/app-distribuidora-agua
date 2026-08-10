import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { RouteOrderDto } from './route-order.dto.js';

export class CreateDeliveryRouteDto {
  @IsString()
  @MaxLength(191)
  name!: string;

  @IsDateString()
  routeDate!: string;

  @IsString()
  warehouseId!: string;

  @IsString()
  driverId!: string;

  @IsString()
  vehicleId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteOrderDto)
  orders!: RouteOrderDto[];
}
