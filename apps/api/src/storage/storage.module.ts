import { Module } from '@nestjs/common';
import { LocalStorageProvider } from './local-storage.provider.js';
import { STORAGE_PROVIDER } from './storage.types.js';

@Module({
  providers: [
    LocalStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: LocalStorageProvider
    }
  ],
  exports: [LocalStorageProvider, STORAGE_PROVIDER]
})
export class StorageModule {}
