import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class FailStopDto {
  @IsString()
  idempotencyKey!: string;

  @IsString()
  @MaxLength(191)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  observations?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @IsOptional()
  @IsString()
  photoBase64?: string;
}
