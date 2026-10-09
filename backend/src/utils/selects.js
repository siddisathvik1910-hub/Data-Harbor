/**
 * Explicit Prisma `select`s. `filePath` (the storage key) is intentionally NEVER included,
 * so it cannot leak through any API response.
 */
const datasetBase = {
  id: true,
  title: true,
  description: true,
  category: true,
  tags: true,
  status: true,
  visibility: true,
  fileName: true,
  fileSize: true,
  fileType: true,
  rejectionReason: true,
  downloadCount: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
};

export const datasetSelect = {
  ...datasetBase,
  owner: { select: { id: true, name: true } },
};

export const adminDatasetSelect = {
  ...datasetBase,
  owner: { select: { id: true, name: true, email: true } },
};
