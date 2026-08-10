import { Type } from 'class-transformer';
import { IsArray, IsIn, IsObject, IsString, ValidateNested } from 'class-validator';

export class SyncOperationDto {
  @IsString()
  idempotencyKey!: string;

  @IsIn(['complete_stop', 'fail_stop'])
  action!: 'complete_stop' | 'fail_stop';

  @IsString()
  routeOrderId!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class SyncOperationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations!: SyncOperationDto[];
}
