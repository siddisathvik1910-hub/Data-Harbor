import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
import { parse } from '../utils/validate.js';
import { notify } from '../utils/notify.js';

/**
 * Two routers are exported:
 *   datasetAccessRouter  mounted at /api/datasets/:datasetId/access-requests  (create a request)
 *   router (default)     mounted at /api/access-requests                       (list / respond)
 */
export const datasetAccessRouter = Router({ mergeParams: true });
const router = Router();

datasetAccessRouter.use(requireAuth('user'));
router.use(requireAuth('user'));

const messageSchema = z.object({ message: z.string().trim().max(500).optional() });
const noteSchema = z.object({ note: z.string().trim().max(500).optional() });

const requestInclude = {
  dataset: { select: { id: true, title: true, visibility: true, owner: { select: { id: true, name: true } } } },
  requester: { select: { id: true, name: true, email: true } },
};

// ----------------------------------------------------- create (as consumer)
datasetAccessRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { message } = parse(messageSchema, req.body ?? {});

    const request = await prisma.$transaction(
      async (tx) => {
        const dataset = await tx.dataset.findUnique({ where: { id: req.params.datasetId } });
        if (!dataset || dataset.status !== 'APPROVED') throw new HttpError(404, 'Dataset not found');
        if (dataset.ownerId === req.user.id) throw new HttpError(400, 'You cannot request access to your own dataset');
        if (dataset.visibility === 'PUBLIC') {
          throw new HttpError(400, 'This dataset is public. You can download it without requesting access');
        }

        const open = await tx.accessRequest.findFirst({
          where: { datasetId: dataset.id, requesterId: req.user.id, status: { in: ['PENDING', 'APPROVED'] } },
        });
        if (open?.status === 'PENDING') throw new HttpError(409, 'You already have a pending request for this dataset');
        if (open?.status === 'APPROVED') throw new HttpError(409, 'You already have access to this dataset');

        const created = await tx.accessRequest.create({
          data: { datasetId: dataset.id, requesterId: req.user.id, message: message || null },
          include: requestInclude,
        });
        await notify(tx, dataset.ownerId, {
          type: 'ACCESS_REQUEST_RECEIVED',
          title: 'New access request',
          message: `${req.user.name} requested access to "${dataset.title}".`,
          link: '/requests/received',
        });
        return created;
      },
      // Serializable closes the race where two simultaneous clicks both pass the duplicate check.
      { isolationLevel: 'Serializable' }
    );

    res.status(201).json({ request });
  })
);

// -------------------------------------------------- list (publisher / consumer)
router.get(
  '/received',
  asyncHandler(async (req, res) => {
    const status = parse(z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() }), req.query).status;
    const items = await prisma.accessRequest.findMany({
      where: { dataset: { ownerId: req.user.id }, ...(status && { status }) },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  })
);

router.get(
  '/sent',
  asyncHandler(async (req, res) => {
    const items = await prisma.accessRequest.findMany({
      where: { requesterId: req.user.id },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  })
);

// ------------------------------------------------- respond (publisher only)
function respond(decision) {
  return asyncHandler(async (req, res) => {
    const { note } = parse(noteSchema, req.body ?? {});
    const approved = decision === 'APPROVED';

    const request = await prisma.$transaction(async (tx) => {
      const current = await tx.accessRequest.findUnique({
        where: { id: req.params.id },
        include: { dataset: true },
      });
      if (!current) throw new HttpError(404, 'Request not found');
      // Rule 5: only the dataset owner may decide. Anyone else (even another logged-in user) is refused.
      if (current.dataset.ownerId !== req.user.id) throw new HttpError(403, 'Only the dataset owner can respond to this request');
      if (current.status !== 'PENDING') throw new HttpError(409, `This request was already ${current.status.toLowerCase()}`);

      const updated = await tx.accessRequest.update({
        where: { id: current.id },
        data: { status: decision, responseNote: note || null, respondedAt: new Date() },
        include: requestInclude,
      });
      await notify(tx, current.requesterId, {
        type: approved ? 'ACCESS_REQUEST_APPROVED' : 'ACCESS_REQUEST_REJECTED',
        title: approved ? 'Access granted' : 'Access request declined',
        message: approved
          ? `Your request for "${current.dataset.title}" was approved. You can now download it.`
          : `Your request for "${current.dataset.title}" was declined.${note ? ` Note: ${note}` : ''}`,
        link: approved ? `/datasets/${current.datasetId}` : '/requests/sent',
      });
      return updated;
    });
    res.json({ request });
  });
}

router.post('/:id/approve', respond('APPROVED'));
router.post('/:id/reject', respond('REJECTED'));

export default router;
