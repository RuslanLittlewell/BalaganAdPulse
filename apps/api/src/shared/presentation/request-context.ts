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

export function enterWithRequestContext(context: RequestContext): void {
  storage.enterWith(context);
}

export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  const actor = req.actor;
  if (!actor) {
    next(new Error("Actor is unavailable in request context"));
    return;
  }
  const principal = req.principal;
  if (!principal) {
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

export function getRequestContext(): RequestContext {
  const context = storage.getStore();
  if (!context) throw new Error("Request context is unavailable");
  return context;
}

export function getOptionalRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
