import multer from "multer";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "#shared/domain/index.js";
import { MAX_COVER_BYTES } from "../../domain/cover.js";

const receive = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_COVER_BYTES, files: 1 } }).single("image");

export const coverUpload: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  receive(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new AppError("validation", "A cover is a JPEG, PNG or WebP image up to 10 MB"));
      return;
    }
    next(error);
  });
};
