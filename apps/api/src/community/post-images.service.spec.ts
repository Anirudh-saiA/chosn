import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/drizzle.provider';
import { InvalidImageError, PostImagesService, type UploadedFileLike } from './post-images.service';
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
vi.mock('file-type', () => ({
  fromBuffer: vi.fn(async () => ({ ext: 'jpg', mime: 'image/jpeg' })),
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
  buffer: Buffer.from('not-really-a-jpeg-but-file-type-is-mocked'),
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
