import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RecurringOrdersController } from './recurring-orders.controller.js';
import { RecurringOrdersService } from './recurring-orders.service.js';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [RecurringOrdersController],
  providers: [RecurringOrdersService]
})
export class RecurringOrdersModule {}
