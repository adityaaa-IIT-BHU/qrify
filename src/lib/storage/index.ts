import type { StorageProvider } from "@/lib/storage/interface";
import { LocalStorage } from "@/lib/storage/local";
import { S3Storage } from "@/lib/storage/s3";

export { fileServeUrl } from "@/lib/storage/interface";
export type { StorageProvider } from "@/lib/storage/interface";

let instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  instance = process.env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
  return instance;
}
