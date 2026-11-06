import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { TariffUseCases } from "#modules/tariffs/application/tariff-use-cases.js";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createTrialGuard(tariffs: Pick<TariffUseCases, "assertWritable">): RequestHandler {
  return function guardTrial(req: Request, _res: Response, next: NextFunction): void {
    if (!req.actor || READ_METHODS.has(req.method)) {
      next();
      return;
    }
    tariffs.assertWritable(req.actor.orgId).then(() => next(), next);
  };
}
