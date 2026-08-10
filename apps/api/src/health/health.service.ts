import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalStorageProvider } from '../storage/local-storage.provider.js';

export type HealthStatus = {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    api: 'ok';
    database: 'ok' | 'error';
    storage: {
      provider: 'local';
      root: string;
    };
  };
};

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(LocalStorageProvider)
    private readonly storage: LocalStorageProvider
  ) {}

  async check(): Promise<HealthStatus> {
    let database: 'ok' | 'error' = 'ok';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
    }

    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        database,
        storage: {
          provider: 'local',
          root: this.storage.getRootPath()
        }
      }
    };
  }
}
