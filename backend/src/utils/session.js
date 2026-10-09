import jwt from 'jsonwebtoken';
import { config } from '../config.js';

/**
 * Admin and user sessions use DIFFERENT cookie names and different JWT audiences.
 * Both portals run on localhost (cookies are not port-isolated), so this is what
 * guarantees an admin token can never authenticate a user route, and vice versa.
 */
export const COOKIE_NAMES = { admin: 'ds_admin_token', user: 'ds_user_token' };
const ISSUER = 'dataset-platform';

export const audienceForRole = (role) => (role === 'ADMIN' ? 'admin' : 'user');

export function signToken(user) {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    audience: audienceForRole(user.role),
    issuer: ISSUER,
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyToken(token, audience) {
  return jwt.verify(token, config.jwtSecret, { audience, issuer: ISSUER });
}

const cookieBase = () => ({
  httpOnly: true,
  sameSite: config.cookieSameSite,
  secure: config.isProd || config.cookieSameSite === 'none',
  path: '/',
});

export function setAuthCookie(res, audience, token) {
  res.cookie(COOKIE_NAMES[audience], token, { ...cookieBase(), maxAge: config.cookieMaxAgeMs });
}

export function clearAuthCookie(res, audience) {
  res.clearCookie(COOKIE_NAMES[audience], cookieBase());
}

export const toPublicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  createdAt: u.createdAt,
});
