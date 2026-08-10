import { IsInt, IsString, Min } from 'class-validator';

export class RouteOrderDto {
  @IsString()
  orderId!: string;

  @IsInt()
  @Min(1)
  sequence!: number;
}
