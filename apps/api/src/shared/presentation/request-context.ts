import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Actor } from "@adpulse/access-policy";

export interface RequestActor extends Actor {
  name: string;
  email: string;
}

export interface RequestContext {
  actor: RequestActor;
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return storage.run(context, callback);
}

/** Primarily useful for service-level tests whose call is not reached through
 * Express. Production requests should always use the middleware above. */
export function enterWithRequestContext(context: RequestContext): void {
  storage.enterWith(context);
}

/** Makes request metadata available to service code without threading it
 * through every controller and service signature. Must be mounted after
 * authentication and actor resolution: the first supplies the name and email
 * the audit trail snapshots, the second the role and organization. */
export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  const actor = req.actor;
  if (!actor) {
    // A middleware-order programming error, not a caller error.
    next(new Error("Actor is unavailable in request context"));
    return;
  }
  const principal = req.principal;
  if (!principal) {
    // This is a middleware-order programming error, not a caller error.
    next(new Error("Actor identity is unavailable in request context"));
    return;
  }

  runWithRequestContext({
    actor: { ...actor, name: principal.name, email: principal.email },
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
    requestId: req.get("x-request-id") || randomUUID(),
  }, next);
}

/** Request-scoped context for audit writes. Throwing outside the middleware is
 * intentional: silently writing an event without an actor would make the
 * trail less trustworthy than failing the mutation. */
export function getRequestContext(): RequestContext {
  const context = storage.getStore();
  if (!context) throw new Error("Request context is unavailable");
  return context;
}

export function getOptionalRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
