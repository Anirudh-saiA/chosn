import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { fromBuffer as sniffFileType } from 'file-type';
import sharp from 'sharp';
import { classifyImage } from '../moderation/classifier.service';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { postImages, posts } from '../db/schema';
import { StorageService } from './storage.service';

/**
 * Multer's actual output shape with `memoryStorage()` (`@types/multer`
 * isn't installed — this repo prefers a hand-written structural type
 * over pulling in a type-only package for the handful of fields this
 * service actually reads, same call this codebase makes elsewhere for
 * lean dependencies).
 */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
/** What `file-type`'s magic-byte sniff must agree the file actually is, keyed by its declared extension below. */
const SNIFFED_TO_EXT: Record<string, string> = { jpg: '.jpg', png: '.png', webp: '.webp' };
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
 *
 * Day 26: added two checks ahead of the classifier call — a declared
 * `image/jpeg` mimetype is trivially spoofable (Multer trusts whatever
 * Content-Type the client sent), so `file-type` sniffs the actual magic
 * bytes and the upload is rejected if they disagree. Every accepted
 * image is then re-encoded through sharp (`.rotate()` normalizes
 * orientation first so EXIF's rotation isn't lost, not just its other
 * metadata) before it ever reaches the classifier or the bucket — GPS
 * coordinates and device info in a stranger's photo have no business
 * surviving an upload to a public post.
 */
@Injectable()
export class PostImagesService {
  private readonly logger = new Logger(PostImagesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

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

    // Magic-byte check: a declared `image/jpeg` mimetype is just
    // whatever Content-Type the client sent, trivial to spoof. Reject
    // if the actual bytes don't agree — same rejection path as a bad
    // declared mimetype, before anything is uploaded or re-encoded.
    const sniffed = await sniffFileType(file.buffer);
    const ext = sniffed ? SNIFFED_TO_EXT[sniffed.ext] : undefined;
    if (!sniffed || !ext || sniffed.mime !== file.mimetype) {
      throw new InvalidImageError('This file is not a valid JPEG, PNG, or WebP image.');
    }

    // Strip EXIF (GPS, device info, etc.) by re-encoding — `.rotate()`
    // bakes in EXIF orientation first so the re-encode doesn't silently
    // rotate the image now that the orientation tag is gone.
    const stripped = await sharp(file.buffer).rotate().toBuffer();

    const url = await this.storage.upload(stripped, file.mimetype, ext);

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
    // reject the upload outright: the object is deleted from the bucket
    // and the request fails with a real error, the same as a bad mime
    // type or an oversized file.
    //
    // Day 26: flipped to fail-closed. `classifyImage` resolving `null`
    // (no NSFW provider configured — its own documented no-op
    // convention, same as classifyText) is NOT a failure and still
    // passes through as 'clean' — that's a deliberate, known state, not
    // an outage. But an actual thrown error (network failure, timeout,
    // a malformed response once a real provider is wired up) now
    // rejects the upload instead of silently waving it through: a
    // Legit Check photo that couldn't be screened is exactly the one
    // case this feature exists to prevent showing unreviewed, so an
    // outage in the reviewer is a reason to block, not a reason to skip
    // the review.
    let classifierScore: number | null = null;
    try {
      const verdict = await classifyImage(url);
      if (verdict) {
        classifierScore = verdict.score;
        if (verdict.nsfw) {
          await this.storage.deleteByUrl(url);
          throw new InvalidImageError('This image was flagged by review and could not be uploaded.');
        }
      }
    } catch (err) {
      if (err instanceof InvalidImageError) throw err;
      this.logger.error(`image classification failed — rejecting upload (fail-closed): ${(err as Error).message}`);
      await this.storage.deleteByUrl(url);
      throw new InvalidImageError("We couldn't verify this image — try again.");
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
