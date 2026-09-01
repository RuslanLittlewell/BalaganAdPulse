import multer from "multer";
import { MAX_TASK_IMAGE_BYTES } from "../../domain/image.js";

/**
 * One file per request, capped at the domain's limit. The cap is repeated here
 * because multer has to stop reading before the whole body is in memory; the
 * domain still checks the bytes it is handed, so the rule has one owner and
 * this is only the transport enforcing it early.
 */
export const taskImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TASK_IMAGE_BYTES, files: 1 },
});
