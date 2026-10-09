import { config } from '../config.js';
import { HttpError } from '../utils/errors.js';

export function notFound(_req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${config.maxFileMb} MB)` : `Upload error: ${err.message}`;
    return res.status(400).json({ error: message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'A record with that value already exists' });
  }
  if (err?.code === 'P2034') {
    return res.status(409).json({ error: 'Conflicting request, please try again' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
