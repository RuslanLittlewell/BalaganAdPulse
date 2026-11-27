import { randomUUID } from 'node:crypto';
import express, { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { AppError } from '#shared/domain/index.js';
import { createRateLimit } from '#shared/presentation/rate-limit.js';
import { WEBSITE_KEY_REFUSED, type WebsiteIntakeUseCases } from '#modules/leads/application/website-intake-use-cases.js';
import { WEBSITE_KEY } from '#modules/leads/domain/website-intake.js';
import { WEBSITE_INTAKE_SCRIPT } from './website-intake-script.js';
import { allowSitesSchema, websiteLeadOf, websiteLeadSchema } from './website-intake-schemas.js';
import { marquizLeadOf, marquizWebhookSchema } from './marquiz-webhook-schemas.js';

const keyOf = new WeakMap<Request, string>();

function handle<TRequest extends Request>(action: (req: TRequest, res: Response) => Promise<void>) {
  return (req: TRequest, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

function bodyOf(req: Request): unknown {
  if (typeof req.body !== 'string') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    throw new AppError('validation', 'The body must be JSON');
  }
}

function bearerOf(req: Request): string | undefined {
  const match = /^Bearer (\S+)$/.exec(req.header('authorization') ?? '');
  return match?.[1];
}

function textParam(req: Request, name: string): string | undefined {
  const value = req.params[name];
  return typeof value === 'string' ? value : undefined;
}

function allow(res: Response, origin: string | undefined): void {
  res.vary('Origin');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
}

export function createWebsiteIntakeRouter(intake: WebsiteIntakeUseCases): Router {
  const router = Router();
  const byVisitor = createRateLimit({ windowMs: 60_000, limit: 20 });
  const byKey = createRateLimit({ windowMs: 60_000, limit: 300, keyOf: (req) => keyOf.get(req) ?? 'unknown' });

  router.get('/script.js', (_req, res) => {
    res.type('application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(WEBSITE_INTAKE_SCRIPT);
  });

  router.use('/leads', (req, res, next) => {
    if (req.method !== 'OPTIONS') {
      next();
      return;
    }
    allow(res, req.header('origin'));
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    res.status(204).end();
  });

  router.post('/leads', byVisitor, express.text({ type: () => true, limit: '64kb' }), (req, res, next) => {
    try {
      const parsed = websiteLeadSchema.safeParse(bodyOf(req) ?? {});
      if (!parsed.success) throw new AppError('validation', 'The lead is not valid');
      const key = parsed.data.key ?? bearerOf(req);
      if (!key || !WEBSITE_KEY.test(key)) throw new AppError('forbidden', WEBSITE_KEY_REFUSED);
      keyOf.set(req, key);
      res.locals.lead = { body: parsed.data, key };
      next();
    } catch (error) {
      next(error);
    }
  }, byKey, handle(async (req, res) => {
    const { body, key } = res.locals.lead as { body: ReturnType<typeof websiteLeadSchema.parse>; key: string };
    const origin = req.header('origin');
    if (body.hp) {
      allow(res, origin);
      res.status(202).json({ ok: true });
      return;
    }
    const lead = websiteLeadOf(body, body.id ?? randomUUID());
    await intake.receive({ key, origin, lead }, bearerOf(req) !== undefined);
    allow(res, origin);
    res.status(202).json({ ok: true });
  }));

  const marquiz: RequestHandler[] = [(req, _res, next) => {
    const key = textParam(req, 'key');
    if (!key || !WEBSITE_KEY.test(key)) {
      next(new AppError('forbidden', WEBSITE_KEY_REFUSED));
      return;
    }
    keyOf.set(req, key);
    next();
  }, byKey, express.text({ type: () => true, limit: '64kb' }), handle(async (req, res) => {
    const parsed = marquizWebhookSchema.safeParse(bodyOf(req) ?? {});
    const lead = parsed.success ? marquizLeadOf(parsed.data) : null;
    if (!lead) throw new AppError('validation', 'The body is not a Marquiz submission');
    await intake.receive({ key: keyOf.get(req)!, origin: undefined, lead, campaignId: textParam(req, 'campaignId') }, true);
    res.status(200).json({ ok: true });
  })];
  router.post('/marquiz/:key', ...marquiz);
  router.post('/marquiz/:key/:campaignId', ...marquiz);

  return router;
}

export function createWebsiteKeyRouter(intake: WebsiteIntakeUseCases): Router {
  const router = Router();
  const actorOf = (req: Request) => {
    if (!req.actor) throw new AppError('unauthorized', 'Authentication required');
    return req.actor;
  };
  router.get('/:id/website-key', handle(async (req: Request<{ id: string }>, res) => {
    res.json(await intake.read(actorOf(req), req.params.id));
  }));
  router.put('/:id/website-key', handle(async (req: Request<{ id: string }>, res) => {
    const existing = await intake.read(actorOf(req), req.params.id);
    res.status(existing ? 200 : 201).json(existing ?? await intake.create(actorOf(req), req.params.id));
  }));
  router.post('/:id/website-key/rotate', handle(async (req: Request<{ id: string }>, res) => {
    res.json(await intake.rotate(actorOf(req), req.params.id));
  }));
  router.put('/:id/website-key/sites', handle(async (req: Request<{ id: string }>, res) => {
    res.json(await intake.allowSites(actorOf(req), req.params.id, allowSitesSchema.parse(req.body).sites));
  }));
  router.delete('/:id/website-key', handle(async (req: Request<{ id: string }>, res) => {
    await intake.remove(actorOf(req), req.params.id);
    res.status(204).send();
  }));
  return router;
}
