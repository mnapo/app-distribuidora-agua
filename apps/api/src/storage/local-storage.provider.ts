import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SaveFileInput, StoredFile, StorageProvider } from './storage.types.js';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly rootPath: string;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.rootPath = path.resolve(this.config.get<string>('LOCAL_STORAGE_ROOT', './storage'));
  }

  getRootPath(): string {
    return this.rootPath;
  }

  async save(input: SaveFileInput): Promise<StoredFile> {
    const extension = this.extensionFor(input.originalName, input.mimeType);
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const relativeDir = path.join(this.clean(input.tenantId), this.clean(input.entityType), this.clean(input.entityId));
    const absoluteDir = path.join(this.rootPath, relativeDir);
    const storageKey = path.join(relativeDir, fileName).replace(/\\/g, '/');

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(path.join(absoluteDir, fileName), input.buffer);

    return {
      storageKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.buffer.length
    };
  }

  private clean(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private extensionFor(originalName: string, mimeType: string): string {
    const parsed = path.extname(originalName);
    if (parsed) return parsed.toLowerCase();
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/jpeg') return '.jpg';
    return '.bin';
  }
}
