import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import type { Request } from 'express';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'payment-proofs');
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const paymentProofUploadOptions = {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (
      req: Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const clinicId =
        (req as unknown as { clinicId?: number }).clinicId ?? 'unknown';
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      callback(null, `${clinicId}-${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
      callback(
        new BadRequestException('Format file harus JPG, PNG, WEBP, atau PDF'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

export function proofFileToUrl(file?: Express.Multer.File): string | null {
  if (!file) return null;
  return `/uploads/payment-proofs/${file.filename}`;
}
