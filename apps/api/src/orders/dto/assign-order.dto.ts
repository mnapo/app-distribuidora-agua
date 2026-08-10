import { IsOptional, IsString } from 'class-validator';

export class AssignOrderDto {
  @IsString()
  driverId!: string;

  @IsString()
  vehicleId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
