/**
 * Storage keys (not raw provider URLs) are what gets persisted on model rows
 * (e.g. ResumeVersion.fileUrl). Resumes are PII, so we never hand out a
 * public/static URL — every read goes through the authenticated
 * `app/api/files/[...key]/route.ts` handler, which calls `getObjectBuffer`
 * and checks the requester actually owns (or was legitimately sent) the
 * file before streaming it.
 */
export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<{ key: string }>;
  getObjectBuffer(key: string): Promise<{ buffer: Buffer; contentType: string } | null>;
  deleteObject(key: string): Promise<void>;
}

/** Internal, auth-checked URL the app should link to — never the provider's own URL. */
export function fileServeUrl(key: string): string {
  return `/api/files/${key}`;
}
