import { Router, type NextFunction, type Request, type Response } from "express";
import { ValidationError } from "../../../../shared/presentation/http-errors.js";
import { AppError } from "../../../../shared/domain/index.js";
import { avatarUpload } from "../../../../shared/presentation/avatar-upload.js";
import { assertAvatarPath, assertAvatarPng } from "../../../../shared/presentation/avatar.js";
import { createRateLimit } from "../../../../shared/presentation/rate-limit.js";
import type { IdentityUseCases } from "../../application/identity-use-cases.js";
import { loginSchema, refreshSchema, registerSchema, updateProfileSchema } from "./identity-schemas.js";
import { clearAuthCookies, readCookie, REFRESH_COOKIE, setAuthCookies } from "./auth-cookies.js";

const resets = new Set<() => void>();
export function resetIdentityRateLimits(): void { resets.forEach((reset) => reset()); }
/** The caller's id, narrowed away from undefined. Every route here sits behind
 * the authentication middleware, which is what puts the principal on the
 * request; the check is what keeps an undefined id out of a query. */
function userId(req: Request): string {
  if (!req.principal?.id) throw new AppError("unauthorized", "Authentication required");
  return req.principal.id;
}

function handle(action: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}
export function createIdentityHttpRouters(useCases: IdentityUseCases) {
  const credentialLimit = createRateLimit({ windowMs: 900_000, limit: 10 });
  const sessionLimit = createRateLimit({ windowMs: 900_000, limit: 60 });
  resets.add(() => { credentialLimit.reset(); sessionLimit.reset(); });
  const authRouter = Router();
  authRouter.post("/register", credentialLimit, handle(async (req, res) => {
    const tokens = await useCases.register(registerSchema.parse(req.body));
    setAuthCookies(res, tokens); res.status(201).json(tokens);
  }));
  authRouter.post("/login", credentialLimit, handle(async (req, res) => {
    const tokens = await useCases.login(loginSchema.parse(req.body));
    setAuthCookies(res, tokens); res.json(tokens);
  }));
  authRouter.post("/refresh", sessionLimit, handle(async (req, res) => {
    const refreshToken = readCookie(req, REFRESH_COOKIE) ?? refreshSchema.parse(req.body).refreshToken;
    const tokens = await useCases.refresh(refreshToken);
    setAuthCookies(res, tokens); res.json(tokens);
  }));
  authRouter.post("/logout", sessionLimit, handle(async (req, res) => {
    const refreshToken = readCookie(req, REFRESH_COOKIE) ?? refreshSchema.parse(req.body).refreshToken;
    await useCases.logout(refreshToken); clearAuthCookies(res); res.status(204).send();
  }));
  const userRouter = Router();
  userRouter.get("/profile", handle(async (req, res) => { res.json(await useCases.profile(userId(req))); }));
  userRouter.patch("/profile", handle(async (req, res) => {
    const tokens = await useCases.updateProfile(userId(req), updateProfileSchema.parse(req.body));
    setAuthCookies(res, tokens); res.json(tokens);
  }));
  userRouter.put("/avatar", avatarUpload.single("image"), handle(async (req, res) => {
    if (!req.file) throw new ValidationError("Avatar PNG is required");
    const avatarPath = String(req.body.avatarPath ?? "");
    assertAvatarPng(req.file.buffer); assertAvatarPath(avatarPath);
    await useCases.saveAvatar(userId(req), req.file.buffer, avatarPath);
    res.status(204).send();
  }));
  return { authRouter, userRouter };
}
