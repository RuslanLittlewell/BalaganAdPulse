import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '#shared/domain/index.js';
import type { ConversionsApiUseCases } from '#modules/conversions/application/conversions-api-use-cases.js';

export const datasetSettingsSchema = z.object({
  datasetId: z.string().trim().regex(/^\d{5,20}$/, 'The dataset ID is a number of 5 to 20 digits'),
  token: z.string().trim().min(1).max(8192).regex(/^\S+$/).optional(),
  testEventCode: z.string().trim().max(64).nullable().optional().transform((value) => value || null),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, 'The currency is a three-letter code').optional(),
}).strict();

export function createConversionsRouter(conversions: ConversionsApiUseCases) {
  const router = Router();
  router.use('/:id/conversions-api', (req, _res, next) => {
    if (!req.actor) return next(new AppError('unauthorized', 'Authentication required'));
    next();
  });
  router.get('/:id/conversions-api', async (req, res) => { res.json(await conversions.read(req.actor!, req.params.id)); });
  router.put('/:id/conversions-api', async (req, res) => { res.json(await conversions.save(req.actor!, req.params.id, datasetSettingsSchema.parse(req.body))); });
  router.delete('/:id/conversions-api', async (req, res) => { await conversions.disconnect(req.actor!, req.params.id); res.status(204).send(); });
  return router;
}
