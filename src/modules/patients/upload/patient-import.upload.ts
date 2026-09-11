import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';

const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const patientImportUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
      callback(
        new BadRequestException('Format file harus XLSX, XLS, atau CSV'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
