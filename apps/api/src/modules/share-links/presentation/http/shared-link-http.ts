import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "#shared/domain/index.js";
import type { ShareLinkUseCases } from "#modules/share-links/application/share-link-use-cases.js";

export function createSharedLinkOpening(links: ShareLinkUseCases): RequestHandler {
  return function openSharedLink(req: Request, _res: Response, next: NextFunction): void {
    links
      .open(String(req.params.token ?? ""))
      .then((actor) => {
        req.actor = actor;
        next();
      })
      .catch(next);
  };
}

export function createSharedLinkDescription(links: ShareLinkUseCases): RequestHandler {
  return function describeSharedLink(req: Request, res: Response, next: NextFunction): void {
    if (!req.actor) {
      next(new AppError("unauthorized", "Authentication required"));
      return;
    }
    links.describe(req.actor).then((shared) => { res.json(shared); }, next);
  };
}
