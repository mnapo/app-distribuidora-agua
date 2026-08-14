import { IsEnum, IsOptional } from 'class-validator';
import { DispenserStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { CreateDispenserDto } from './create-dispenser.dto.js';

export class UpdateDispenserDto extends PartialType(CreateDispenserDto) {
  @IsOptional()
  @IsEnum(DispenserStatus)
  status?: DispenserStatus;
}
