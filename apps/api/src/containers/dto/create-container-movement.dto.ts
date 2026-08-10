import { ContainerMovementType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateContainerMovementDto {
  @IsString()
  customerId!: string;

  @IsString()
  containerTypeId!: string;

  @IsEnum(ContainerMovementType)
  type!: ContainerMovementType;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  routeOrderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  notes?: string;
}
