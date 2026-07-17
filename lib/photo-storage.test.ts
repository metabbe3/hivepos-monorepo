import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  savePhotoBytes,
  readPhotoBytes,
  deletePhoto,
  uploadDir,
} from "./photo-storage";

// Point the storage layer at a throwaway temp dir. uploadDir() reads this env
// lazily on each call, so setting it here (after the hoisted import) takes effect
// when the tests invoke the wrappers.
const TMP = mkdtempSync(path.join(tmpdir(), "photo-storage-"));

describe("LocalDiskPhotoStorage (via the free-function wrappers)", () => {
  beforeAll(() => {
    process.env.PHOTO_UPLOAD_DIR = TMP;
  });

  afterAll(() => {
    delete process.env.PHOTO_UPLOAD_DIR;
    rmSync(TMP, { recursive: true, force: true });
  });

  it("save → read round-trips bytes that land under uploadDir()", async () => {
    const rel = "t1/ORD1/before-x.webp";
    const data = Buffer.from([1, 2, 3, 4, 5]);
    await savePhotoBytes(rel, data);

    // The file really landed on disk under the configured upload dir.
    expect(() => statSync(path.join(uploadDir(), rel))).not.toThrow();
    expect(Array.from(await readPhotoBytes(rel))).toEqual([1, 2, 3, 4, 5]);
  });

  it("deletePhoto removes the file", async () => {
    const rel = "t1/ORD1/after-y.webp";
    await savePhotoBytes(rel, Buffer.from([9, 9]));
    await deletePhoto(rel);
    expect(() => statSync(path.join(uploadDir(), rel))).toThrow();
  });

  it("deletePhoto on a missing file is a no-op (ENOENT swallowed)", async () => {
    await expect(deletePhoto("t1/never-existed.webp")).resolves.toBeUndefined();
  });

  it("rejects a relPath that escapes uploadDir() (traversal guard)", async () => {
    await expect(
      savePhotoBytes("../escape.webp", Buffer.from([1])),
    ).rejects.toThrow("Invalid photo storage path");
  });
});
