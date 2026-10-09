import { pipeline } from 'node:stream/promises';
import { storage } from '../storage/index.js';
import { HttpError } from './errors.js';

const MIME = {
  csv: 'text/csv',
  json: 'application/json',
  txt: 'text/plain',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

/**
 * Stream a stored dataset file to the client as a download.
 * ONLY call this after the route has performed its authorization checks.
 */
export async function sendDatasetFile(res, dataset) {
  let handle;
  try {
    handle = await storage.open(dataset.filePath);
  } catch (err) {
    if (err.code === 'ENOENT') throw new HttpError(410, 'The file is missing from storage');
    throw err;
  }

  const asciiName = dataset.fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  res.setHeader('Content-Type', MIME[dataset.fileType] || 'application/octet-stream');
  res.setHeader('Content-Length', handle.size);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(dataset.fileName)}`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');

  try {
    await pipeline(handle.stream, res);
  } catch (err) {
    // Client aborted the download: nothing to report.
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') throw err;
  }
}
