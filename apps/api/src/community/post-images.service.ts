import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { classifyImage } from '../moderation/classifier.service';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { postImages, posts } from '../db/schema';

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

    // Classify before the row is visible as anything but 'pending' — see
    // this class's own doc comment. Best-effort: a classifier failure
    // must not block the upload itself (same "never let bookkeeping mask
    // the real result" convention the price-fetch pipeline follows).
    let classifierStatus: 'clean' | 'flagged' | 'pending' = 'pending';
    let classifierScore: number | null = null;
    try {
      const verdict = await classifyImage(url);
      if (verdict) {
        classifierStatus = verdict.nsfw ? 'flagged' : 'clean';
        classifierScore = verdict.score;
      } else {
        classifierStatus = 'clean'; // stub returned null — see doc comment
      }
    } catch (err) {
      this.logger.warn(`image classification failed, treating as unclassified: ${(err as Error).message}`);
    }

    const [row] = await this.db
      .insert(postImages)
      .values({
        postId,
        checklistItemId: checklistItemId ?? null,
        url,
        classifierStatus,
        classifierScore: classifierScore !== null ? classifierScore.toString() : null,
      })
      .returning();

    return { id: row!.id, url: row!.url, classifierStatus: row!.classifierStatus };
  }
}
