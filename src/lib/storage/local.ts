import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PutObjectInput, StorageProvider } from "@/lib/storage/interface";

const ROOT = path.join(process.cwd(), "storage-local");

/** Dev-only filesystem storage. Not multi-instance safe — production uses S3Storage. */
export class LocalStorage implements StorageProvider {
  private resolve(key: string): string {
    const resolved = path.join(ROOT, key);
    if (!resolved.startsWith(ROOT)) {
      throw new Error("Invalid storage key (path traversal attempt)");
    }
    return resolved;
  }

  async putObject({ key, body }: PutObjectInput): Promise<{ key: string }> {
    const filePath = this.resolve(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    // content type is inferred from the key's extension on read for local
    // storage (kept simple; S3Storage stores it as real object metadata).
    return { key };
  }

  async getObjectBuffer(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const buffer = await readFile(this.resolve(key));
      return { buffer, contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

function contentTypeFor(key: string): string {
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
