import { Router } from "express";
import * as controller from "./auth.controller.js";

/** Mounted at /api/auth, ahead of requireAuth — these are the only open routes. */
export const authRouter = Router();
authRouter.post("/register", controller.register);
authRouter.post("/login", controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
