import multer from "multer";

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => done(null, file.mimetype === "image/png"),
});
