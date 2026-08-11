export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export type SaveFileInput = {
  tenantId: string;
  entityType: string;
  entityId: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
};

export type StoredFile = {
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export interface StorageProvider {
  save(input: SaveFileInput): Promise<StoredFile>;
}
