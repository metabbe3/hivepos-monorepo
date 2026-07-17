import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Storage backend for compressed order photos.
 *
 * The contract is deliberately **S3-shaped**: `relPath` is the object key, and
 * the three methods map cleanly to S3 operations:
 *   saveBytes   → PutObject
 *   readBytes   → GetObject
 *   deleteBytes → DeleteObject
 *
 * Migrating to AWS S3 / Cloudflare R2 / MinIO / DigitalOcean Spaces when customer
 * volume grows is a one-file change: implement `S3PhotoStorage implements
 * PhotoStorage` (via `@aws-sdk/client-s3`) and add an
 * `if (process.env.S3_BUCKET) return new S3PhotoStorage()` branch to
 * `getPhotoStorage()` below. No caller changes — routes and cleanup go through
 * the free-function wrappers at the bottom of this file.
 */
export interface PhotoStorage {
  saveBytes(relPath: string, bytes: Uint8Array): Promise<void>;
  readBytes(relPath: string): Promise<Buffer>;
  deleteBytes(relPath: string): Promise<void>;
}

/**
 * Root dir for local-disk storage. In Docker a host bind-mount
 * (`./data/uploads` → `/app/data/uploads`) makes the files plain host files —
 * directly inspectable/backupable/cleanable, no opaque named volume, and they
 * survive container rebuilds. Read lazily so tests can point at a temp dir.
 */
export function uploadDir(): string {
  return process.env.PHOTO_UPLOAD_DIR ?? "./data/uploads";
}

/** Local-disk backend (the default). */
class LocalDiskPhotoStorage implements PhotoStorage {
  /** Resolve a host-relative relPath to an absolute path under uploadDir(). */
  private abs(relPath: string): string {
    const root = path.resolve(uploadDir());
    const target = path.resolve(root, relPath);
    // Defense-in-depth against path traversal. relPath is built server-side from
    // tenantId/orderNumber, but never trust composition blindly.
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error("Invalid photo storage path");
    }
    return target;
  }

  async saveBytes(relPath: string, bytes: Uint8Array): Promise<void> {
    const full = this.abs(relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
  }

  async readBytes(relPath: string): Promise<Buffer> {
    return fs.readFile(this.abs(relPath));
  }

  async deleteBytes(relPath: string): Promise<void> {
    try {
      await fs.unlink(this.abs(relPath));
    } catch (e) {
      // ponytail: ignore missing — the DB row is the source of truth; a file may
      // already be gone (manual cleanup, failed write). Don't fail the purge.
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
}

let _storage: PhotoStorage | null = null;

/**
 * Factory returning the active backend. Today: local disk on a host bind-mount.
 *
 * S3 migration (when customer volume grows):
 *   1. `npm i @aws-sdk/client-s3`
 *   2. implement `class S3PhotoStorage implements PhotoStorage` (PutObject /
 *      GetObject / DeleteObject; relPath is the key, optionally bucket-prefixed)
 *   3. add here: `if (process.env.S3_BUCKET) return new S3PhotoStorage();`
 *   4. set S3_BUCKET + AWS creds in .env / docker-compose
 * No other file changes — every caller uses the wrappers below.
 */
export function getPhotoStorage(): PhotoStorage {
  // ponytail: no S3 backend yet — single LocalDisk impl. The interface + factory
  // exist so the swap is one file + one env var, not a rewrite of every caller.
  if (!_storage) _storage = new LocalDiskPhotoStorage();
  return _storage;
}

// ── Free-function wrappers ──────────────────────────────────────────────
// Every caller (routes, cleanup, tests) imports these. They delegate to the
// active backend, so swapping storage (H1) needs zero call-site changes.
export const savePhotoBytes: PhotoStorage["saveBytes"] = (relPath, bytes) =>
  getPhotoStorage().saveBytes(relPath, bytes);
export const readPhotoBytes: PhotoStorage["readBytes"] = (relPath) =>
  getPhotoStorage().readBytes(relPath);
export const deletePhoto: PhotoStorage["deleteBytes"] = (relPath) =>
  getPhotoStorage().deleteBytes(relPath);
