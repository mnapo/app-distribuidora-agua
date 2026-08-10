import { Type } from 'class-transformer';
import { SubscriptionFrequency } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { SubscriptionPlanItemDto } from './subscription-plan-item.dto.js';

export class CreateSubscriptionPlanDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(SubscriptionFrequency)
  frequency?: SubscriptionFrequency;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionPlanItemDto)
  items!: SubscriptionPlanItemDto[];
}
