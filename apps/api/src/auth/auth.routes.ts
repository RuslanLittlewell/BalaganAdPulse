import { Router } from "express";
import { createRateLimit } from "../middleware/rate-limit.js";
import * as controller from "./auth.controller.js";

const WINDOW_MS = 15 * 60 * 1000;

/** `login` and `register` are the routes that cost a scrypt hash, so they get
 * the tight window. Ten attempts in a quarter of an hour is generous for
 * someone typing a password and mean for anything else. */
const credentialLimit = createRateLimit({ windowMs: WINDOW_MS, limit: 10 });

/** `refresh` and `logout` are a database lookup and a SHA-256 digest. The
 * ceiling is higher because a signed-in tab renews every fifteen minutes and a
 * user may have several open — that is ordinary traffic, not an attack. */
const sessionLimit = createRateLimit({ windowMs: WINDOW_MS, limit: 60 });

/** Mounted at /api/auth, ahead of requireAuth — these are the only open routes. */
export const authRouter = Router();
authRouter.post("/register", credentialLimit, controller.register);
authRouter.post("/login", credentialLimit, controller.login);
authRouter.post("/refresh", sessionLimit, controller.refresh);
authRouter.post("/logout", sessionLimit, controller.logout);

/** The limiters are module state, so a test file's cases would otherwise share
 * one window and the later ones would answer 429 for reasons of their own
 * making. */
export function resetAuthRateLimits(): void {
  credentialLimit.reset();
  sessionLimit.reset();
}
