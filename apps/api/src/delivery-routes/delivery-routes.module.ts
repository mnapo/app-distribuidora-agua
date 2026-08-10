import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DeliveryRoutesController } from './delivery-routes.controller.js';
import { DeliveryRoutesService } from './delivery-routes.service.js';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [DeliveryRoutesController],
  providers: [DeliveryRoutesService]
})
export class DeliveryRoutesModule {}
