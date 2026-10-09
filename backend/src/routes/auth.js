import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
import { parse } from '../utils/validate.js';
import { clearAuthCookie, setAuthCookie, signToken, toPublicUser } from '../utils/session.js';

const router = Router();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required').max(200),
});

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
let dummyHash;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('not-a-real-password', config.bcryptRounds));

router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password } = parse(signupSchema, req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, 'An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const user = await prisma.user.create({ data: { name, email, passwordHash, role: 'USER' } });

    setAuthCookie(res, 'user', signToken(user));
    res.status(201).json({ user: toPublicUser(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);

    // Admin accounts cannot log in here: only role USER is looked up.
    const user = await prisma.user.findFirst({ where: { email, role: 'USER' } });
    const ok = await bcrypt.compare(password, user ? user.passwordHash : getDummyHash());
    if (!user || !ok) throw new HttpError(401, 'Invalid email or password');
    if (user.status === 'SUSPENDED') throw new HttpError(403, 'Your account has been suspended');

    setAuthCookie(res, 'user', signToken(user));
    res.json({ user: toPublicUser(user) });
  })
);

router.post('/logout', (_req, res) => {
  clearAuthCookie(res, 'user');
  res.json({ ok: true });
});

router.get('/me', requireAuth('user'), (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

// ---------------------------------------------------------------------------
// Admin auth (login only - there is no signup; the admin is created by the seed script)
// ---------------------------------------------------------------------------
export const adminAuthRouter = Router();

adminAuthRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);

    const user = await prisma.user.findFirst({ where: { email, role: 'ADMIN' } });
    const ok = await bcrypt.compare(password, user ? user.passwordHash : getDummyHash());
    if (!user || !ok) throw new HttpError(401, 'Invalid email or password');
    if (user.status === 'SUSPENDED') throw new HttpError(403, 'Your account has been suspended');

    setAuthCookie(res, 'admin', signToken(user));
    res.json({ user: toPublicUser(user) });
  })
);

adminAuthRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res, 'admin');
  res.json({ ok: true });
});

adminAuthRouter.get('/me', requireAuth('admin'), (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

export default router;
