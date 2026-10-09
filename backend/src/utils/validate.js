import { HttpError } from './errors.js';

/** Validate `data` with a Zod schema; throw a 400 HttpError with per-field messages on failure. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'Validation failed', result.error.flatten().fieldErrors);
  }
  return result.data;
}

/** Convert page/limit into Prisma skip/take and build the standard paginated response. */
export function paginate(page, limit) {
  return { skip: (page - 1) * limit, take: limit };
}

export function pageResult(items, total, page, limit) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}
