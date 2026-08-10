import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ContainersController } from './containers.controller.js';
import { ContainersService } from './containers.service.js';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ContainersController],
  providers: [ContainersService]
})
export class ContainersModule {}
