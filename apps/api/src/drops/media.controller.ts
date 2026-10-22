import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Response } from 'express';

const FILE = /^[A-Za-z0-9._-]{3,80}\.(jpg|jpeg|png|webp)$/;
const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const ROOT = () => resolve(process.env.MEDIA_DIR ?? resolve(process.cwd(), '../../data/media'));

/** Serves the pictures fetched for upcoming drops and for news (data/media/releases and data/media/news, or MEDIA_DIR). Filenames are checked strictly: no paths, no surprises. */
@Controller('media')
export class MediaController {
  @Get(':folder/:file')
  file(@Param('folder') folder: string, @Param('file') file: string, @Res() res: Response): void {
    if ((folder !== 'releases' && folder !== 'news') || !FILE.test(file)) throw new NotFoundException();
    const dir = resolve(ROOT(), folder);
    const path = resolve(dir, file);
    if (!path.startsWith(dir) || !existsSync(path)) throw new NotFoundException();
    res.setHeader('Content-Type', TYPES[file.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    createReadStream(path).pipe(res);
  }
}
