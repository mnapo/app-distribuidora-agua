import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateWebhookEndpointDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(191)
  events!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  secret?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
