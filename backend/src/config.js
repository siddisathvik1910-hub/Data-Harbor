import 'dotenv/config';
import path from 'node:path';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name} (see .env.example)`);
  return value;
}

const env = process.env.NODE_ENV || 'development';

export const config = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT || 4000),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  bcryptRounds: 12,

  adminOrigin: process.env.ADMIN_ORIGIN || 'http://localhost:5173',
  userOrigin: process.env.USER_ORIGIN || 'http://localhost:5174',

  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  maxFileMb: Number(process.env.MAX_FILE_MB || 50),
  allowedExtensions: ['.csv', '.json', '.xlsx', '.zip', '.txt'],
};
