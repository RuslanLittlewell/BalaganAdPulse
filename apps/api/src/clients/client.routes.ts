import { Router } from "express";
import * as controller from "./client.controller.js";

export const clientRouter = Router();

clientRouter.post("/", controller.create);
clientRouter.get("/", controller.list);
clientRouter.get("/:id", controller.getOne);
clientRouter.patch("/:id", controller.update);
clientRouter.delete("/:id", controller.remove);
