import { Router } from "express";
import * as controller from "./project.controller.js";
import { avatarUpload } from "../lib/avatar-upload.js";

export const projectRouter = Router();

projectRouter.post("/", controller.create);
projectRouter.get("/", controller.list);
projectRouter.get("/:id", controller.getOne);
projectRouter.patch("/:id", controller.update);
projectRouter.delete("/:id", controller.remove);
projectRouter.put("/:id/avatar", avatarUpload.single("image"), controller.uploadAvatar);
