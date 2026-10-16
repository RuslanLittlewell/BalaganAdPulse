import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { PlatformUseCases } from "#modules/platform/application/platform-use-cases.js";
import {
  createOrganizationSchema,
  organizationParamsSchema,
  updateOrganizationSchema,
} from "./platform-schemas.js";

function principalOf(req: Request) {
  if (!req.principal) throw new AppError("unauthorized", "Authentication required");
  return req.principal;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

function organizationId(req: Request<{ id: string }>): string {
  const params = organizationParamsSchema.safeParse(req.params);
  if (!params.success) throw new AppError("not-found", "Organization not found");
  return params.data.id;
}

export function createPlatformRouter(useCases: PlatformUseCases): Router {
  const router = Router();
  router.use((req: Request, _res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(() => useCases.assertPlatformAdmin(principalOf(req)))
      .then(() => next(), next);
  });
  router.get("/organizations", handle(async (_req, res) => {
    res.json(await useCases.list());
  }));
  router.post("/organizations", handle(async (req, res) => {
    const input = createOrganizationSchema.parse(req.body);
    res.status(201).json(await useCases.create(input));
  }));
  router.patch("/organizations/:id", handle(async (req: Request<{ id: string }>, res) => {
    const id = organizationId(req);
    const change = updateOrganizationSchema.parse(req.body);
    res.json(await useCases.update(id, change));
  }));
  router.delete("/organizations/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.delete(organizationId(req));
    res.status(204).send();
  }));
  router.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError("not-found", "Endpoint not found"));
  });
  return router;
}
