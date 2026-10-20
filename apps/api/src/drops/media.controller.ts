import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Response } from 'express';

const FILE = /^[A-Za-z0-9._-]{3,80}\.(jpg|jpeg|png|webp)$/;
const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Serves the pictures fetched for upcoming drops (data/media/releases, or MEDIA_DIR). Filenames are checked strictly: no paths, no surprises. */
@Controller('media/releases')
export class MediaController {
  private readonly dir = resolve(process.env.MEDIA_DIR ?? resolve(process.cwd(), '../../data/media'), 'releases');

  @Get(':file')
  file(@Param('file') file: string, @Res() res: Response): void {
    if (!FILE.test(file)) throw new NotFoundException();
    const path = resolve(this.dir, file);
    if (!path.startsWith(this.dir) || !existsSync(path)) throw new NotFoundException();
    res.setHeader('Content-Type', TYPES[file.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    createReadStream(path).pipe(res);
  }
}
