import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
import { pageResult, paginate, parse } from '../utils/validate.js';
import { adminDatasetSelect } from '../utils/selects.js';
import { notify } from '../utils/notify.js';
import { sendDatasetFile } from '../utils/sendFile.js';

const router = Router();
router.use(requireAuth('admin')); // every route below is admin-only (rule 8)

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
};

// ---------------------------------------------------------------- dashboard
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [totalUsers, suspendedUsers, totalDatasets, pending, approved, rejected] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: 'USER', status: 'SUSPENDED' } }),
      prisma.dataset.count(),
      prisma.dataset.count({ where: { status: 'PENDING' } }),
      prisma.dataset.count({ where: { status: 'APPROVED' } }),
      prisma.dataset.count({ where: { status: 'REJECTED' } }),
    ]);
    res.json({ totalUsers, suspendedUsers, totalDatasets, pending, approved, rejected });
  })
);

// -------------------------------------------------------------------- users
const usersQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  ...pageQuery,
});

const userListSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  createdAt: true,
  _count: { select: { datasets: true } },
};

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const q = parse(usersQuery, req.query);
    const where = { role: 'USER' };
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: userListSelect,
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
      }),
    ]);
    const items = users.map(({ _count, ...u }) => ({ ...u, datasetCount: _count.datasets }));
    res.json(pageResult(items, total, q.page, q.limit));
  })
);

router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'USER' },
      select: userListSelect,
    });
    if (!user) throw new HttpError(404, 'User not found');
    const datasets = await prisma.dataset.findMany({
      where: { ownerId: user.id },
      select: adminDatasetSelect,
      orderBy: { createdAt: 'desc' },
    });
    const { _count, ...rest } = user;
    res.json({ user: { ...rest, datasetCount: _count.datasets }, datasets });
  })
);

router.patch(
  '/users/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }), req.body);
    // Only normal users can be suspended - never an admin.
    const target = await prisma.user.findFirst({ where: { id: req.params.id, role: 'USER' } });
    if (!target) throw new HttpError(404, 'User not found');
    const user = await prisma.user.update({
      where: { id: target.id },
      data: { status },
      select: userListSelect,
    });
    const { _count, ...rest } = user;
    res.json({ user: { ...rest, datasetCount: _count.datasets } });
  })
);

// ----------------------------------------------------------------- datasets
const datasetsQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  ...pageQuery,
});

router.get(
  '/datasets',
  asyncHandler(async (req, res) => {
    const q = parse(datasetsQuery, req.query);
    const where = {};
    if (q.status) where.status = q.status;
    if (q.visibility) where.visibility = q.visibility;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { owner: { name: { contains: q.search, mode: 'insensitive' } } },
        { owner: { email: { contains: q.search, mode: 'insensitive' } } },
      ];
    }
    const [total, items] = await Promise.all([
      prisma.dataset.count({ where }),
      prisma.dataset.findMany({
        where,
        select: adminDatasetSelect,
        orderBy: { createdAt: 'desc' },
        ...paginate(q.page, q.limit),
      }),
    ]);
    res.json(pageResult(items, total, q.page, q.limit));
  })
);

// Oldest first so the queue is worked in submission order.
router.get(
  '/publish-requests',
  asyncHandler(async (_req, res) => {
    const items = await prisma.dataset.findMany({
      where: { status: 'PENDING' },
      select: adminDatasetSelect,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ items, total: items.length });
  })
);

// Admin may download ANY file (rule 2) so they can inspect it before deciding.
router.get(
  '/datasets/:id/download',
  asyncHandler(async (req, res) => {
    const dataset = await prisma.dataset.findUnique({ where: { id: req.params.id } });
    if (!dataset) throw new HttpError(404, 'Dataset not found');
    await sendDatasetFile(res, dataset); // admin downloads are not counted in downloadCount
  })
);

router.post(
  '/datasets/:id/approve',
  asyncHandler(async (req, res) => {
    const dataset = await prisma.$transaction(async (tx) => {
      const current = await tx.dataset.findUnique({ where: { id: req.params.id } });
      if (!current) throw new HttpError(404, 'Dataset not found');
      if (current.status !== 'PENDING') throw new HttpError(409, `Dataset is already ${current.status.toLowerCase()}`);

      const updated = await tx.dataset.update({
        where: { id: current.id },
        data: { status: 'APPROVED', rejectionReason: null, reviewedAt: new Date() },
        select: adminDatasetSelect,
      });
      await notify(tx, current.ownerId, {
        type: 'DATASET_APPROVED',
        title: 'Dataset approved',
        message: `"${current.title}" was approved and is now live in the catalog (${current.visibility.toLowerCase()}).`,
        link: `/datasets/${current.id}`,
      });
      return updated;
    });
    res.json({ dataset });
  })
);

router.post(
  '/datasets/:id/reject',
  asyncHandler(async (req, res) => {
    const { reason } = parse(
      z.object({
        reason: z.string().trim().min(3, 'A rejection reason is required (min 3 characters)').max(500),
      }),
      req.body
    );

    const dataset = await prisma.$transaction(async (tx) => {
      const current = await tx.dataset.findUnique({ where: { id: req.params.id } });
      if (!current) throw new HttpError(404, 'Dataset not found');
      if (current.status !== 'PENDING') throw new HttpError(409, `Dataset is already ${current.status.toLowerCase()}`);

      const updated = await tx.dataset.update({
        where: { id: current.id },
        data: { status: 'REJECTED', rejectionReason: reason, reviewedAt: new Date() },
        select: adminDatasetSelect,
      });
      await notify(tx, current.ownerId, {
        type: 'DATASET_REJECTED',
        title: 'Dataset rejected',
        message: `"${current.title}" was rejected. Reason: ${reason}`,
        link: `/my-datasets`,
      });
      return updated;
    });
    res.json({ dataset });
  })
);

export default router;
