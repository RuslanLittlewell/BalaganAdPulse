import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../../../shared/domain/index.js";
import type { AuditReader } from "../../application/audit-use-cases.js";

const optionalUuid = z.uuid().optional();

export const auditQuerySchema = z.object({
  clientId: optionalUuid,
  projectId: optionalUuid,
  campaignId: optionalUuid,
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  actorId: optionalUuid,
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  cursor: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function createAuditRouter<TEvent>(reader: AuditReader<TEvent>): Router {
  const router = Router();
  router.get("/", (req: Request, res: Response, next: NextFunction) => {
    const actor = req.actor;
    if (!actor) {
      next(new AppError("unauthorized", "Authentication required"));
      return;
    }
    const query = auditQuerySchema.parse(req.query);
    reader.list(actor, query).then((page) => res.json(page)).catch(next);
  });
  return router;
}
