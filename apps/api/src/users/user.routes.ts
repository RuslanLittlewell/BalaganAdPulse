import { Router } from "express";
import * as controller from "./user.controller.js";
import { avatarUpload } from "../lib/avatar-upload.js";

export const userRouter = Router();

userRouter.get("/profile", controller.profile);
userRouter.patch("/profile", controller.updateProfile);
userRouter.put("/avatar", avatarUpload.single("image"), controller.uploadAvatar);
