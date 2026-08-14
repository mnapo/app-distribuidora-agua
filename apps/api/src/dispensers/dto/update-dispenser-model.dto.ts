import { PartialType } from '@nestjs/mapped-types';
import { CreateDispenserModelDto } from './create-dispenser-model.dto.js';

export class UpdateDispenserModelDto extends PartialType(CreateDispenserModelDto) {}
