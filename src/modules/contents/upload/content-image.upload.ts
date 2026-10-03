import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
/** Phone photos and the rendered 1080 × 1920 PNG both fit comfortably. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const contentImageUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
      callback(
        new BadRequestException('Format gambar harus JPG, PNG, atau WEBP'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
