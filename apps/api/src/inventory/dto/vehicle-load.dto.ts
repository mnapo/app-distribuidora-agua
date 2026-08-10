import { IsNumber, IsString, Min } from 'class-validator';

export class VehicleLoadDto {
  @IsString()
  productId!: string;

  @IsString()
  warehouseId!: string;

  @IsString()
  vehicleId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;
}
