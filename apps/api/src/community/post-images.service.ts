import { existsSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { classifyImage } from '../moderation/classifier.service';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { postImages, posts } from '../db/schema';

/**
 * Local disk storage under apps/api/uploads/ — no cloud storage
 * configured for this local-dev-scoped feature (see docs/community/
 * README.md). Owned here (not the controller) because both the
 * controller's Multer config and this service's own reject-and-delete
 * path (see `attach()` below) need the same directory.
 */
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

/**
 * Multer's actual output shape (`@types/multer` isn't installed — this
 * repo prefers a hand-written structural type over pulling in a
 * type-only package for the handful of fields this service actually
 * reads, same call this codebase makes elsewhere for lean dependencies).
 */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  filename: string;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024;

export class InvalidImageError extends Error {}

/**
 * Legit Check is this app's first real image-upload UGC surface (task
 * 2) — every image goes through Day 17's `classifyImage` stub before
 * it's shown as 'clean', not just stored and trusted. The stub always
 * resolves `null` today (no NSFW provider configured — see its own doc
 * comment), which this service treats as "nothing flagged," so a photo
 * displays immediately; swapping in a real provider later changes what
 * this service does with a non-null result, not whether it calls one.
 */
@Injectable()
export class PostImagesService {
  private readonly logger = new Logger(PostImagesService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async attach(
    postId: string,
    file: UploadedFileLike,
    checklistItemId: string | undefined,
  ): Promise<{ id: string; url: string; classifierStatus: string }> {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new InvalidImageError(`Unsupported file type "${file.mimetype}" — only JPEG, PNG, or WebP.`);
    }
    if (file.size > MAX_BYTES) {
      throw new InvalidImageError('Image too large — 8MB max.');
    }

    const [post] = await this.db
      .select({ id: posts.id, postType: posts.postType, checklist: posts.legitCheckChecklist })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (!post) throw new NotFoundException({ error: 'not_found', message: 'Post not found.' });

    if (checklistItemId) {
      const checklist = (post.checklist as { id: string; label: string }[] | null) ?? [];
      if (!checklist.some((c) => c.id === checklistItemId)) {
        throw new InvalidImageError(`"${checklistItemId}" isn't a checklist item on this post.`);
      }
    }

    const url = `/uploads/${file.filename}`;

    // Classify before the row exists at all — see this class's own doc
    // comment. Day 23 QA fix: this used to insert a 'flagged' row
    // regardless of the verdict, which meant a flagged image was never
    // actually rejected, just labeled — PostCard.tsx's own "Removed —
    // flagged by review" placeholder was the only thing standing
    // between a viewer and the image, and nothing stopped the raw file
    // being fetched directly by URL either. There's no broadcast-
    // latency constraint here (unlike chat's deliberate broadcast-then-
    // review tradeoff) — classification already runs synchronously
    // before the row is created, so a flagged result can and should
    // reject the upload outright: the file is deleted from disk and the
    // request fails with a real error, the same as a bad mime type or
    // an oversized file. A classifier failure or a 'clean'/unconfigured
    // (null) verdict still fails open onto 'clean' — a moderation tool
    // outage must never itself become the reason every upload breaks.
    let classifierScore: number | null = null;
    try {
      const verdict = await classifyImage(url);
      if (verdict) {
        classifierScore = verdict.score;
        if (verdict.nsfw) {
          await unlink(join(UPLOADS_DIR, file.filename)).catch((err) => {
            this.logger.warn(`could not delete rejected upload ${file.filename}: ${(err as Error).message}`);
          });
          throw new InvalidImageError('This image was flagged by review and could not be uploaded.');
        }
      }
    } catch (err) {
      if (err instanceof InvalidImageError) throw err;
      this.logger.warn(`image classification failed, treating as unclassified: ${(err as Error).message}`);
    }

    const [row] = await this.db
      .insert(postImages)
      .values({
        postId,
        checklistItemId: checklistItemId ?? null,
        url,
        classifierStatus: 'clean', // any row that reaches this insert already passed the check above
        classifierScore: classifierScore !== null ? classifierScore.toString() : null,
      })
      .returning();

    return { id: row!.id, url: row!.url, classifierStatus: row!.classifierStatus };
  }
}
