import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/drizzle.provider';
import { InvalidImageError, PostImagesService, sniffImage, type UploadedFileLike } from './post-images.service';
import type { StorageService } from './storage.service';

/**
 * Day 26 — the classifier was flipped from fail-open to fail-closed
 * (see attach()'s own comment): a thrown error/timeout from
 * `classifyImage` must now reject the upload, not silently wave it
 * through as 'clean'. This is the regression test for that path —
 * `classifyImage` itself is a stub today (always resolves `null`), so
 * the only way to exercise "the classifier actually failed" is to mock
 * it throwing, same as a real provider's network error or timeout
 * would.
 */

vi.mock('../moderation/classifier.service', () => ({
  classifyImage: vi.fn(),
}));
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    rotate: () => ({
      toBuffer: async () => Buffer.from('stripped-bytes'),
    }),
  })),
}));

import { classifyImage } from '../moderation/classifier.service';

const POST_ROW = { id: 'post-1', postType: 'legit_check', checklist: null };

function fakeDb() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [POST_ROW],
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => [
          { id: 'img-1', url: 'https://bucket.example/legit-check/x.jpg', classifierStatus: 'clean' },
        ],
      }),
    }),
  } as unknown as Db;
}

function fakeStorage() {
  return {
    upload: vi.fn(async () => 'https://bucket.example/legit-check/x.jpg'),
    deleteByUrl: vi.fn(async () => undefined),
  } as unknown as StorageService;
}

const file: UploadedFileLike = {
  originalname: 'photo.jpg',
  mimetype: 'image/jpeg',
  size: 1_000,
  buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpeg-body-bytes')]),
};

describe('PostImagesService — classifier failure mode', () => {
  beforeEach(() => {
    vi.mocked(classifyImage).mockReset();
  });

  it('rejects the upload and deletes the uploaded object when classifyImage throws (fail-closed)', async () => {
    vi.mocked(classifyImage).mockRejectedValue(new Error('Perspective API timed out'));
    const storage = fakeStorage();
    const service = new PostImagesService(fakeDb(), storage);

    const error = await service.attach('post-1', file, undefined).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(InvalidImageError);
    expect((error as InvalidImageError).message).toMatch(/couldn't verify this image/i);
    expect(storage.deleteByUrl).toHaveBeenCalledWith('https://bucket.example/legit-check/x.jpg');
  });

  it('still accepts the upload when the classifier resolves null (unconfigured — not a failure)', async () => {
    vi.mocked(classifyImage).mockResolvedValue(null);
    const storage = fakeStorage();
    const service = new PostImagesService(fakeDb(), storage);

    const result = await service.attach('post-1', file, undefined);

    expect(result.classifierStatus).toBe('clean');
    expect(storage.deleteByUrl).not.toHaveBeenCalled();
  });
});

describe('sniffImage (replaces file-type, SEC-6)', () => {
  it('recognises JPEG, PNG and WebP by their first bytes', () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 0]))).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toEqual({ ext: 'png', mime: 'image/png' });
    expect(sniffImage(Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1'))).toEqual({ ext: 'webp', mime: 'image/webp' });
  });
  it('rejects other formats, including a crafted ASF/GIF/SVG/empty file', () => {
    expect(sniffImage(Buffer.from([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c]))).toBeUndefined();
    expect(sniffImage(Buffer.from('GIF89a......'))).toBeUndefined();
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeUndefined();
    expect(sniffImage(Buffer.alloc(0))).toBeUndefined();
  });
});
