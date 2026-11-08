import multer from "multer";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "#shared/domain/index.js";
import { MAX_TASK_DOCUMENT_BYTES } from "#modules/tasks/domain/document.js";

const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TASK_DOCUMENT_BYTES, files: 1 },
}).single("file");

export const taskDocumentUpload: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  receive(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new AppError("validation", "Document is too large; the limit is 20 MB"));
      return;
    }
    next(error);
  });
};
