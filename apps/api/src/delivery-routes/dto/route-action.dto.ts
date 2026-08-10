import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RouteActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  notes?: string;
}
