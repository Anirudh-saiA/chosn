import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Day 26 — Legit Check uploads move off the API server's local disk
 * (Railway redeploys wipe it, and a second instance wouldn't share it
 * anyway) onto S3-compatible object storage. Cloudflare R2 and AWS S3
 * both speak the same `S3Client` API — only the endpoint/region differ
 * — so this service is written against the generic SDK rather than
 * either provider's own client, and works unchanged once either is
 * provisioned (see apps/api/.env.example for which vars come from which
 * dashboard).
 *
 * Deliberately only supports a public bucket (fronted by a custom
 * domain/CDN, or R2's own public-bucket URL) — `postImages.url` is
 * written once at upload time and read back unchanged on every post
 * fetch afterward (see posts.service.ts), so a signed URL stored there
 * would silently start 404ing once it expired, with nothing re-signing
 * it. A public bucket is also the realistic choice for a moderated
 * image gallery everyone who can see the post is already allowed to
 * view — nothing here needs per-viewer access control.
 *
 * Fails loud at construction, not at first upload: once disk storage is
 * removed there is no safe local fallback for this feature the way
 * RESEND_API_KEY/PERSPECTIVE_API_KEY have a documented no-op mode, so a
 * missing bucket config should surface at boot, not as a 500 on the
 * first user who tries to attach a photo.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    const bucket = process.env.STORAGE_BUCKET;
    const endpoint = process.env.STORAGE_ENDPOINT;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    const publicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL;
    if (!bucket || !endpoint || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
      throw new Error(
        'Object storage not configured — STORAGE_BUCKET, STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, ' +
          'STORAGE_SECRET_ACCESS_KEY and STORAGE_PUBLIC_BASE_URL must all be set (see apps/api/.env.example). ' +
          'Legit Check photo uploads have no local-disk fallback.',
      );
    }
    this.bucket = bucket;
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, '');
    this.client = new S3Client({
      region: process.env.STORAGE_REGION || 'auto', // R2 ignores region and documents "auto"; S3 needs a real one
      endpoint,
      forcePathStyle: true, // R2 and most non-AWS S3-compatible endpoints need this; harmless on real S3
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /** Uploads an already-validated, EXIF-stripped buffer and returns its stable public URL. */
  async upload(buffer: Buffer, contentType: string, extension: string): Promise<string> {
    const key = `legit-check/${randomUUID()}${extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return `${this.publicBaseUrl}/${key}`;
  }

  /**
   * Task 2's classifier-rejects-it path: the object is already in the
   * bucket by the time `classifyImage` runs (see post-images.service.ts
   * — classification needs a fetchable URL, same contract
   * `classifyImage`'s own doc comment describes), so a flagged verdict
   * deletes it rather than leaving an orphaned object with no DB row
   * pointing at it. Best-effort: a delete failure is logged, not thrown
   * — the upload is already being rejected either way, and a stray
   * object in the bucket is a cleanup job, not a reason to turn a
   * moderation rejection into a 500.
   */
  async deleteByUrl(url: string): Promise<void> {
    if (!url.startsWith(`${this.publicBaseUrl}/`)) return;
    const key = url.slice(this.publicBaseUrl.length + 1);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`could not delete rejected upload ${key}: ${(err as Error).message}`);
    }
  }
}
