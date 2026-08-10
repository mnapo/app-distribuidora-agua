import { Module } from '@nestjs/common';
import { DispensersController } from './dispensers.controller.js';
import { DispensersService } from './dispensers.service.js';

@Module({
  controllers: [DispensersController],
  providers: [DispensersService]
})
export class DispensersModule {}
