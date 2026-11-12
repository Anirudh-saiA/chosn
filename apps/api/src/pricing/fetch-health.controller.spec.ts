import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { FetchHealthController } from './fetch-health.controller';
import type { FetchHealthService, RetailerHealth } from './fetch-health.service';

/**
 * Day 37 — the whole point of `/health/fetch/status` is that an
 * external, non-sandboxed monitor (cron-job.org) can alert on HTTP
 * status alone. This is the regression test that it actually would have
 * caught the real incident it was built for: Day 29's discovery that
 * Superkicks/VegNonVeg had been permanently failing on two specific
 * variants each (root-caused and fixed Day 32 — see
 * 0017_remove_orphaned_manual_mappings.sql). The fixture below is the
 * real shape that incident had, not an invented one: four healthy
 * fixture-mode retailers plus the two manual boutiques showing
 * failures24h > 0.
 */

function healthyRetailer(slug: string): RetailerHealth {
  return {
    slug,
    name: slug,
    integrationType: 'api',
    status: 'pending_integration',
    mode: 'fixture',
    fetchEveryMinutes: 720,
    lastSuccessAt: new Date().toISOString(),
    minutesSinceSuccess: 5,
    snapshots24h: 20,
    failures24h: 0,
    stale: false,
  };
}

// The actual Day 29 incident shape: both manual boutiques failing on
// real dead-lettered jobs, last real success old enough to also be
// past their own two-cycle staleness window.
const SUPERKICKS_INCIDENT: RetailerHealth = {
  slug: 'superkicks',
  name: 'Superkicks',
  integrationType: 'manual',
  status: 'active',
  mode: 'manual',
  fetchEveryMinutes: 10080,
  lastSuccessAt: '2026-09-07T07:17:42.395Z',
  minutesSinceSuccess: 8886,
  snapshots24h: 0,
  failures24h: 2,
  stale: true,
};

const VEGNONVEG_INCIDENT: RetailerHealth = {
  ...SUPERKICKS_INCIDENT,
  slug: 'vegnonveg',
  name: 'VegNonVeg',
  lastSuccessAt: '2026-09-07T07:17:42.160Z',
};

function fakeResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function controllerWith(retailers: RetailerHealth[]): FetchHealthController {
  const health = { summary: vi.fn().mockResolvedValue(retailers) } as unknown as FetchHealthService;
  return new FetchHealthController(health);
}

describe('FetchHealthController.fetchStatus — GET /health/fetch/status', () => {
  it('returns 200 { ok: true } when every retailer is healthy', async () => {
    const controller = controllerWith([
      healthyRetailer('flipkart'),
      healthyRetailer('myntra'),
      healthyRetailer('ajio'),
      healthyRetailer('end-clothing'),
    ]);
    const res = fakeResponse();

    await controller.fetchStatus(res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('would have caught the real Day 29 Superkicks/VegNonVeg incident: returns 503 naming both retailers', async () => {
    const controller = controllerWith([
      healthyRetailer('flipkart'),
      healthyRetailer('myntra'),
      healthyRetailer('ajio'),
      healthyRetailer('end-clothing'),
      SUPERKICKS_INCIDENT,
      VEGNONVEG_INCIDENT,
    ]);
    const res = fakeResponse();

    await controller.fetchStatus(res);

    expect(res.status).toHaveBeenCalledWith(503);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body.ok).toBe(false);
    const slugs = body.degraded.map((d: { slug: string }) => d.slug);
    expect(slugs).toEqual(expect.arrayContaining(['superkicks', 'vegnonveg']));
    expect(slugs).toHaveLength(2); // the four healthy retailers must NOT appear
    for (const entry of body.degraded) {
      expect(entry.reason).toBe('stale_and_failing'); // both stale AND failures24h > 0 in this fixture
      expect(entry.failures24h).toBe(2);
    }
  });

  it('returns 503 for a retailer that is only stale (0 failures) — a real, distinct failure mode', async () => {
    const wentQuiet: RetailerHealth = { ...healthyRetailer('ajio'), failures24h: 0, stale: true };
    const controller = controllerWith([healthyRetailer('flipkart'), wentQuiet]);
    const res = fakeResponse();

    await controller.fetchStatus(res);

    expect(res.status).toHaveBeenCalledWith(503);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body.degraded).toEqual([
      expect.objectContaining({ slug: 'ajio', reason: 'stale', failures24h: 0 }),
    ]);
  });

  it('returns 503 for a retailer that is only failing (not yet stale) — a real, distinct failure mode', async () => {
    const failingButRecent: RetailerHealth = { ...healthyRetailer('flipkart'), failures24h: 3, stale: false };
    const controller = controllerWith([failingButRecent]);
    const res = fakeResponse();

    await controller.fetchStatus(res);

    expect(res.status).toHaveBeenCalledWith(503);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(body.degraded[0]).toMatchObject({ slug: 'flipkart', reason: 'failing', failures24h: 3 });
  });
});
