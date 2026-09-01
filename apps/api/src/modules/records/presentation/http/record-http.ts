import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../../../shared/domain/index.js";
import type { RecordUseCases } from "../../application/record-use-cases.js";
import {
  createRecordSchema,
  setValueSchema,
  setValuesSchema,
  updateRecordSchema,
} from "./record-schemas.js";

function actorOf(req: Request) {
  if (!req.actor) throw new AppError("unauthorized", "Authentication required");
  return req.actor;
}

function handle<TRequest extends Request>(
  action: (req: TRequest, res: Response) => Promise<void>,
) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

export function createRecordHttpRouters(useCases: RecordUseCases) {
  /** Mounted at /api/campaigns/:campaignId/records */
  const campaignRecordRouter = Router({ mergeParams: true });
  campaignRecordRouter.post("/", handle(async (req: Request<{ campaignId: string }>, res) => {
    const input = createRecordSchema.parse(req.body);
    res.status(201).json(await useCases.create(actorOf(req), req.params.campaignId, input));
  }));

  /** Mounted at /api/records */
  const recordRouter = Router();
  recordRouter.patch("/:id", handle(async (req: Request<{ id: string }>, res) => {
    const input = updateRecordSchema.parse(req.body);
    res.json(await useCases.update(actorOf(req), req.params.id, input));
  }));
  recordRouter.delete("/:id", handle(async (req: Request<{ id: string }>, res) => {
    await useCases.delete(actorOf(req), req.params.id);
    res.status(204).send();
  }));
  recordRouter.put("/:recordId/values", handle(async (req: Request<{ recordId: string }>, res) => {
    const { values } = setValuesSchema.parse(req.body);
    res.json(await useCases.setValues(actorOf(req), req.params.recordId, values));
  }));
  recordRouter.put(
    "/:recordId/values/:propertyId",
    handle(async (req: Request<{ recordId: string; propertyId: string }>, res) => {
      const { value } = setValueSchema.parse(req.body);
      res.json(await useCases.setValue(actorOf(req), req.params.recordId, req.params.propertyId, value));
    }),
  );

  return { campaignRecordRouter, recordRouter };
}
