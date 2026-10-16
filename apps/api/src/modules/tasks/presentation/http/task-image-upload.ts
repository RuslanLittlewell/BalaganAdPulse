import multer from "multer";
import { MAX_TASK_IMAGE_BYTES } from "#modules/tasks/domain/image.js";

export const taskImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TASK_IMAGE_BYTES, files: 1 },
});
