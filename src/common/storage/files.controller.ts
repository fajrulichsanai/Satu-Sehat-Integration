import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { extname } from 'path';
import { stat } from 'fs/promises';
import { Public } from '../../modules/auth/decorators/public.decorator';
import { resolveLocalPublicPath } from './s3-storage.service';

// Only image types are ever stored here (clinic logos/photos); anything else
// is refused rather than served with a guessed type.
const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Serves public files stored on local disk while S3 isn't configured (see
 * S3StorageService). These are clinic logos/photos — shown on documents and
 * the public booking page — so no auth is required, same as the S3
 * public-read objects they stand in for.
 */
@ApiExcludeController()
@Public()
@Controller('files')
export class FilesController {
  @Get('*key')
  async serve(@Param('key') key: string | string[], @Res() res: Response) {
    const relative = Array.isArray(key) ? key.join('/') : key;
    const path = resolveLocalPublicPath(relative);
    const contentType = CONTENT_TYPES[extname(relative).toLowerCase()];
    if (!path || !contentType) throw new NotFoundException();

    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException();

    res.setHeader('Content-Type', contentType);
    // Keys include a timestamp, so a given URL never changes content.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path);
  }
}
