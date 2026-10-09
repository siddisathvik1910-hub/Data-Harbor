import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { storage } from '../storage/index.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
import { pageResult, paginate, parse } from '../utils/validate.js';
import { datasetSelect } from '../utils/selects.js';
import { notify } from '../utils/notify.js';
import { sendDatasetFile } from '../utils/sendFile.js';

const router = Router();
router.use(requireAuth('user')); // user-role cookie only; admin tokens are rejected here (rule 8)

// ------------------------------------------------------------------ schemas
// Tags may arrive as a JSON array, a JSON string, or "a, b, c" (multipart forms send strings).
const tagsSchema = z
  .preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* not JSON, fall through to comma split */
      }
      return v.split(',');
    }
    return [];
  }, z.array(z.string().trim().min(1).max(30)).max(10, 'At most 10 tags'))
  .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]);

const datasetFields = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  category: z.string().trim().min(2, 'Category is required').max(50),
  tags: tagsSchema,
  visibility: z.enum(['PUBLIC', 'PRIVATE'], { message: 'Visibility must be PUBLIC or PRIVATE' }),
});

const catalogQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),
  tag: z.string().trim().max(30).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  sort: z.enum(['newest', 'oldest', 'popular', 'title']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const SORTS = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  popular: { downloadCount: 'desc' },
  title: { title: 'asc' },
};

/** Can this user download this dataset? Single source of truth for rules 2 & 3. */
async function canDownload(dataset, userId) {
  if (dataset.ownerId === userId) return true;
  if (dataset.status !== 'APPROVED') return false;
  if (dataset.visibility === 'PUBLIC') return true;
  const grant = await prisma.accessRequest.findFirst({
    where: { datasetId: dataset.id, requesterId: userId, status: 'APPROVED' },
    select: { id: true },
  });
  return Boolean(grant);
}

// ------------------------------------------------------------------ catalog
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parse(catalogQuery, req.query);
    const where = { status: 'APPROVED' }; // rule 1: only APPROVED is ever listed
    if (q.category) where.category = { equals: q.category, mode: 'insensitive' };
    if (q.tag) where.tags = { has: q.tag.toLowerCase() };
    if (q.visibility) where.visibility = q.visibility;
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
        { tags: { has: q.q.toLowerCase() } },
      ];
    }
    const [total, rows] = await Promise.all([
      prisma.dataset.count({ where }),
      prisma.dataset.findMany({
        where,
        select: datasetSelect,
        orderBy: SORTS[q.sort],
        ...paginate(q.page, q.limit),
      }),
    ]);
    const items = rows.map((d) => ({ ...d, isOwner: d.ownerId === req.user.id }));
    res.json(pageResult(items, total, q.page, q.limit));
  })
);

// Filter options for the catalog sidebar (derived from approved datasets only).
router.get(
  '/filters',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.dataset.findMany({
      where: { status: 'APPROVED' },
      select: { category: true, tags: true },
    });
    const categories = [...new Set(rows.map((r) => r.category))].sort((a, b) => a.localeCompare(b));
    const tagCounts = new Map();
    rows.forEach((r) => r.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)));
    const tags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 30)
      .map(([tag]) => tag);
    res.json({ categories, tags });
  })
);

// -------------------------------------------------------------- my datasets
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const rows = await prisma.dataset.findMany({
      where: { ownerId: req.user.id },
      select: {
        ...datasetSelect,
        _count: { select: { accessRequests: { where: { status: 'PENDING' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const items = rows.map(({ _count, ...d }) => ({ ...d, pendingAccessRequests: _count.accessRequests }));
    res.json({ items });
  })
);

// ------------------------------------------------------------------- create
router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    let storedKey = null;
    try {
      if (!file) throw new HttpError(400, 'A dataset file is required');
      const data = parse(datasetFields, req.body);

      const fileName = path.basename(file.originalname).slice(0, 255);
      storedKey = await storage.save(file.path, fileName);

      // Always starts as PENDING: not visible in the catalog until an admin approves (rule 1).
      const dataset = await prisma.dataset.create({
        data: {
          ...data,
          status: 'PENDING',
          fileName,
          filePath: storedKey,
          fileSize: file.size,
          fileType: path.extname(fileName).slice(1).toLowerCase(),
          ownerId: req.user.id,
        },
        select: datasetSelect,
      });
      res.status(201).json({ dataset });
    } catch (err) {
      // Never leave orphaned files behind if validation or the DB write failed.
      if (storedKey) await storage.remove(storedKey).catch(() => {});
      else if (file) await fs.unlink(file.path).catch(() => {});
      throw err;
    }
  })
);

// ------------------------------------------------------------------- detail
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const dataset = await prisma.dataset.findUnique({ where: { id: req.params.id }, select: datasetSelect });
    const isOwner = dataset?.ownerId === req.user.id;
    // Non-owners can only see APPROVED datasets; everything else looks like it doesn't exist.
    if (!dataset || (dataset.status !== 'APPROVED' && !isOwner)) throw new HttpError(404, 'Dataset not found');

    const result = { dataset: { ...dataset, isOwner }, canDownload: false, myRequest: null, stats: null };

    if (isOwner) {
      result.canDownload = true;
      const grouped = await prisma.accessRequest.groupBy({
        by: ['status'],
        where: { datasetId: dataset.id },
        _count: { _all: true },
      });
      const count = (s) => grouped.find((g) => g.status === s)?._count._all ?? 0;
      result.stats = {
        downloadCount: dataset.downloadCount,
        pendingRequests: count('PENDING'),
        approvedRequests: count('APPROVED'),
        rejectedRequests: count('REJECTED'),
      };
    } else if (dataset.visibility === 'PUBLIC') {
      result.canDownload = true;
    } else {
      // PRIVATE and not the owner: expose my latest request so the UI can show its state.
      const myRequest = await prisma.accessRequest.findFirst({
        where: { datasetId: dataset.id, requesterId: req.user.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, message: true, responseNote: true, createdAt: true, respondedAt: true },
      });
      result.myRequest = myRequest;
      result.canDownload = myRequest?.status === 'APPROVED';
    }
    res.json(result);
  })
);

// -------------------------------------------------------------------- edit
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.dataset.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.ownerId !== req.user.id) throw new HttpError(404, 'Dataset not found');
    if (existing.status === 'APPROVED') {
      throw new HttpError(409, 'Approved datasets can no longer be edited. Delete it and upload a new version instead.');
    }

    const data = parse(datasetFields.partial(), req.body);
    const dataset = await prisma.dataset.update({
      where: { id: existing.id },
      // Editing a REJECTED dataset resubmits it to the admin queue.
      data: { ...data, status: 'PENDING', rejectionReason: null, reviewedAt: null },
      select: datasetSelect,
    });
    res.json({ dataset });
  })
);

// ------------------------------------------------------------------ delete
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.dataset.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.ownerId !== req.user.id) throw new HttpError(404, 'Dataset not found');

    await prisma.dataset.delete({ where: { id: existing.id } }); // access requests cascade
    await storage.remove(existing.filePath).catch((e) => console.error('Failed to remove file', e));
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------- download
// Rules 2, 3 and 9: the ONLY way to get a file is through this authorization check.
router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const dataset = await prisma.dataset.findUnique({ where: { id: req.params.id } });
    const isOwner = dataset?.ownerId === req.user.id;
    if (!dataset || (dataset.status !== 'APPROVED' && !isOwner)) throw new HttpError(404, 'Dataset not found');

    if (!(await canDownload(dataset, req.user.id))) {
      throw new HttpError(403, 'This dataset is private. Request access from the publisher to download it.');
    }

    if (!isOwner) {
      await prisma.dataset.update({ where: { id: dataset.id }, data: { downloadCount: { increment: 1 } } });
    }
    await sendDatasetFile(res, dataset);
  })
);

export default router;
