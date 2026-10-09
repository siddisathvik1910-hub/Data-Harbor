import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Storage abstraction.
 *
 * The rest of the app only ever talks to this interface:
 *   save(sourcePath, originalName) -> key     move an uploaded temp file into storage
 *   saveBuffer(buffer, originalName) -> key   store in-memory content (used by the seed script)
 *   open(key) -> { stream, size }             read a file back
 *   remove(key)                               delete a file (missing file is not an error)
 *
 * To move to S3 later, write an `S3Storage` class with the same four methods
 * (PutObject / GetObject / DeleteObject) and export it from the bottom of this file.
 * No route or controller code has to change.
 *
 * The "key" is an opaque random name stored in Dataset.filePath. Files live OUTSIDE any
 * static folder and are only reachable through authorization-checked download endpoints.
 */
class LocalStorage {
  constructor(rootDir) {
    this.root = rootDir;
    this.filesDir = path.join(rootDir, 'files');
    this.tmpDir = path.join(rootDir, 'tmp');
    fs.mkdirSync(this.filesDir, { recursive: true });
    fs.mkdirSync(this.tmpDir, { recursive: true });
  }

  #newKey(originalName) {
    const ext = path.extname(originalName || '').toLowerCase();
    return `${crypto.randomUUID()}${ext}`;
  }

  /** Resolve a key to an absolute path and refuse anything that escapes the storage dir. */
  #resolve(key) {
    const full = path.resolve(this.filesDir, key);
    if (!full.startsWith(this.filesDir + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async save(sourcePath, originalName) {
    const key = this.#newKey(originalName);
    await fs.promises.rename(sourcePath, this.#resolve(key));
    return key;
  }

  async saveBuffer(buffer, originalName) {
    const key = this.#newKey(originalName);
    await fs.promises.writeFile(this.#resolve(key), buffer);
    return key;
  }

  async open(key) {
    const full = this.#resolve(key);
    const stat = await fs.promises.stat(full); // throws ENOENT if missing
    return { stream: fs.createReadStream(full), size: stat.size };
  }

  async remove(key) {
    try {
      await fs.promises.unlink(this.#resolve(key));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

export const storage = new LocalStorage(config.uploadDir);
export const tmpUploadDir = storage.tmpDir;
