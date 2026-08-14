import { PartialType } from '@nestjs/mapped-types';
import { CreateContainerTypeDto } from './create-container-type.dto.js';

export class UpdateContainerTypeDto extends PartialType(CreateContainerTypeDto) {}
