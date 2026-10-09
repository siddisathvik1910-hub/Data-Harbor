import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { tmpUploadDir } from '../storage/index.js';
import { HttpError } from '../utils/errors.js';

/**
 * Multer writes the incoming file to a temp folder first. The route then validates the
 * form fields and, only if everything is valid, moves the file into permanent storage.
 */
export const upload = multer({
  storage: multer.diskStorage({
    destination: tmpUploadDir,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: config.maxFileMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!config.allowedExtensions.includes(ext)) {
      return cb(new HttpError(400, `File type not allowed. Allowed: ${config.allowedExtensions.join(', ')}`));
    }
    cb(null, true);
  },
});
