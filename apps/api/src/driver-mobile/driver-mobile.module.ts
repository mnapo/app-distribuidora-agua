import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { DriverMobileController } from './driver-mobile.controller.js';
import { DriverMobileService } from './driver-mobile.service.js';

@Module({
  imports: [PrismaModule, AuditModule, BillingModule, StorageModule],
  controllers: [DriverMobileController],
  providers: [DriverMobileService]
})
export class DriverMobileModule {}
