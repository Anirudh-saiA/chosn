import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AuthenticatedRequest, ApiAuthGuard } from '../auth/api-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { InvalidImageError, PostImagesService, type UploadedFileLike } from './post-images.service';

/**
 * Local disk storage under apps/api/uploads/ — no cloud storage
 * configured for this local-dev-scoped feature (see docs/community/
 * README.md). Filenames are regenerated (random uuid + the original
 * extension), never the client-supplied `originalname`, so a crafted
 * filename can't path-traverse or collide with another upload.
 */
const UPLOADS_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

@Controller('community/posts/:postId/images')
export class PostImagesController {
  constructor(private readonly postImages: PostImagesService) {}

  @Post()
  @UseGuards(ApiAuthGuard, RateLimitGuard)
  @RateLimit({ limit: 40, windowSeconds: 3600 })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          if (!ALLOWED_EXT.has(ext)) return cb(new BadRequestException('Unsupported file extension.'), '');
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async upload(
    @Req() req: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body('checklistItemId') checklistItemId?: string,
  ) {
    void req; // ownership isn't enforced on who may attach an image to a post — any signed-in user contributing photos to a shared Legit Check thread is the intended shape (task 2), not just the original poster.
    if (!file) throw new BadRequestException('No file uploaded.');
    try {
      const image = await this.postImages.attach(postId, file, checklistItemId);
      return { image };
    } catch (err) {
      if (err instanceof InvalidImageError) throw new BadRequestException(err.message);
      throw err;
    }
  }
}
