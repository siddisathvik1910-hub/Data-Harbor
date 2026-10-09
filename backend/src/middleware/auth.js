import { prisma } from '../db.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
import { COOKIE_NAMES, verifyToken } from '../utils/session.js';

/**
 * Authentication + role guard in one.
 *
 *   requireAuth('user')   -> only the ds_user_token cookie is read, role must be USER
 *   requireAuth('admin')  -> only the ds_admin_token cookie is read, role must be ADMIN
 *
 * The user is re-loaded from the database on EVERY request, so suspending an account
 * takes effect immediately even if the person still holds a valid token (rule 7).
 */
export const requireAuth = (audience) =>
  asyncHandler(async (req, _res, next) => {
    const token = req.cookies?.[COOKIE_NAMES[audience]];
    if (!token) throw new HttpError(401, 'Not authenticated');

    let payload;
    try {
      payload = verifyToken(token, audience);
    } catch {
      throw new HttpError(401, 'Session expired or invalid');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpError(401, 'Account no longer exists');
    if (user.status === 'SUSPENDED') throw new HttpError(403, 'Your account has been suspended');

    const expectedRole = audience === 'admin' ? 'ADMIN' : 'USER';
    if (user.role !== expectedRole) throw new HttpError(403, 'Forbidden');

    req.user = user;
    next();
  });
