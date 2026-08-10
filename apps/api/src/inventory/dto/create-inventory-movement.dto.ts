import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { InventoryMovementType } from '@prisma/client';

export class CreateInventoryMovementDto {
  @IsString()
  productId!: string;

  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  fromWarehouseId?: string;

  @IsOptional()
  @IsString()
  toWarehouseId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
