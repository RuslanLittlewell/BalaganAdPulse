import { Router, type Request } from 'express';
import { AppError } from '#shared/domain/index.js';
import type { KpiLevel } from '../../domain/kpi.js';
import type { KpiUseCases } from '../../application/kpi-use-cases.js';
import { kpiInputSchema } from './kpi-schemas.js';

export function createKpiRouter(kpis: KpiUseCases) {
  const router = Router();
  const actor = (req: Request) => {
    if (!req.actor) throw new AppError('unauthorized', 'Authentication required');
    return req.actor;
  };
  const levels: Array<[string, (req: Request<{ id?: string }>) => KpiLevel]> = [
    ['/organization/kpi', () => ({ kind: 'organization' })],
    ['/projects/:id/kpi', (req) => ({ kind: 'project', id: req.params.id! })],
    ['/campaigns/:id/kpi', (req) => ({ kind: 'campaign', id: req.params.id! })],
  ];
  for (const [path, levelOf] of levels) {
    router.get(path, async (req, res) => { res.json(await kpis.read(actor(req), levelOf(req))); });
    router.put(path, async (req, res) => {
      const current = actor(req);
      res.json(await kpis.set(current, levelOf(req), kpiInputSchema.parse(req.body)));
    });
    router.delete(path, async (req, res) => { await kpis.clear(actor(req), levelOf(req)); res.status(204).end(); });
  }
  return router;
}
