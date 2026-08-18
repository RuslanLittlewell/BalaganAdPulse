import type { Request } from "express";
import { UnauthorizedError } from "../errors.js";

/** The caller's id, narrowed to a plain string. `req.user` is optional in the
 * type because Express does not know about the middleware, but every route
 * that calls this sits behind requireAuth.
 *
 * The id itself is checked, not just the object: Prisma reads
 * `where: { ownerId: undefined }` as no condition at all, so an undefined id
 * would turn every fragment in `scope.ts` into an unfiltered lookup across
 * every user's data rather than into a 404. */
export function userId(req: Request): string {
  if (!req.user?.id) throw new UnauthorizedError("Authentication required");
  return req.user.id;
}
