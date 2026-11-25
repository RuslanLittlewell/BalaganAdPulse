import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { AppError } from '#shared/domain/index.js';
import type { LeadImportUseCases } from '#modules/leads/application/lead-import-use-cases.js';
import { importPreviewSchema, importRunSchema, importSourceSchema } from './lead-import-schemas.js';

export const leadImportBody = express.json({ limit: '12mb' });

type BoardRequest = Request<{ boardKey: string }>;

export function createLeadImportRouter(imports: LeadImportUseCases) {
  const router = Router({ mergeParams: true });
  const handle = (fn: (req: BoardRequest, res: Response) => Promise<unknown>) => (req: BoardRequest, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };
  const actor = (req: Request) => {
    if (!req.actor) throw new AppError('unauthorized', 'Authentication required');
    return req.actor;
  };

  router.post('/table', handle(async (req, res) => {
    res.json(await imports.table(actor(req), req.params.boardKey, importSourceSchema.parse(req.body)));
  }));
  router.post('/preview', handle(async (req, res) => {
    const { rows } = importPreviewSchema.parse(req.body);
    res.json(await imports.preview(actor(req), req.params.boardKey, rows));
  }));
  router.post('/', handle(async (req, res) => {
    const { rows, choices, placements } = importRunSchema.parse(req.body);
    res.status(201).json(await imports.run(actor(req), req.params.boardKey, rows, choices, placements));
  }));
  return router;
}
