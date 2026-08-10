import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateIntegrationEventDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  type!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  integrationId?: string;
}
