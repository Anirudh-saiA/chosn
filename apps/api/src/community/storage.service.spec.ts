import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageNotConfiguredError, StorageService } from './storage.service';

/**
 * Day 30 — regression test for a real production outage: StorageService
 * used to throw at construction when unconfigured, which took down the
 * entire API (NestJS eagerly instantiates every provider at boot), not
 * just photo uploads. Production had no STORAGE_* vars set from the
 * moment Day 26 merged, so every deploy since crash-looped and Railway
 * silently rolled back to a stale build — see this file's sibling
 * storage.service.ts doc comment for the full story. This test pins the
 * fix: constructing the service with no config must never throw.
 */

const STORAGE_VARS = [
  'STORAGE_BUCKET',
  'STORAGE_ENDPOINT',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
  'STORAGE_PUBLIC_BASE_URL',
] as const;

describe('StorageService — unconfigured is a disabled feature, not a boot failure', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of STORAGE_VARS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of STORAGE_VARS) {
      if (saved[key] !== undefined) process.env[key] = saved[key];
      else delete process.env[key];
    }
  });

  it('does not throw when constructed with no STORAGE_* env vars set', () => {
    expect(() => new StorageService()).not.toThrow();
  });

  it('reports isConfigured: false when unconfigured', () => {
    const service = new StorageService();
    expect(service.isConfigured).toBe(false);
  });

  it('upload() rejects with StorageNotConfiguredError, not a generic crash, when unconfigured', async () => {
    const service = new StorageService();
    await expect(service.upload(Buffer.from('x'), 'image/jpeg', '.jpg')).rejects.toBeInstanceOf(
      StorageNotConfiguredError,
    );
  });

  it('deleteByUrl() no-ops (does not throw) when unconfigured', async () => {
    const service = new StorageService();
    await expect(service.deleteByUrl('https://example.com/legit-check/x.jpg')).resolves.toBeUndefined();
  });

  it('reports isConfigured: true once all five vars are set', () => {
    process.env.STORAGE_BUCKET = 'b';
    process.env.STORAGE_ENDPOINT = 'https://example.com';
    process.env.STORAGE_ACCESS_KEY_ID = 'k';
    process.env.STORAGE_SECRET_ACCESS_KEY = 's';
    process.env.STORAGE_PUBLIC_BASE_URL = 'https://cdn.example.com';
    const service = new StorageService();
    expect(service.isConfigured).toBe(true);
  });
});
