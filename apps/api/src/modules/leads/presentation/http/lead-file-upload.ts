import multer from 'multer';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '#shared/domain/index.js';
import { MAX_LEAD_FILE_BYTES } from '../../domain/lead-file.js';

const receive = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_LEAD_FILE_BYTES, files: 1 } }).single('file');

export const leadFileUpload: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  receive(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new AppError('validation', 'File is too large; the limit is 20 MB'));
      return;
    }
    next(error);
  });
};

export function uploadedName(file: Express.Multer.File): string {
  return Buffer.from(file.originalname, 'latin1').toString('utf8');
}
