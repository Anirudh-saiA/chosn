import { Controller, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { PriceFetchService } from '../queue/price-fetch.service';

/**
 * Day 29 — real gap this session's own catalog expansion exposed: a new
 * retailer_product_mapping row sits price-less for up to a source's
 * whole fetch_frequency_minutes (12h for Flipkart) after a catalog
 * migration lands, because nothing kicks the scheduled queue early.
 * Day 28's 23 new models needed a locally-run `fetch:once` script by
 * hand to get first prices — fine for a session with Railway shell
 * access, not fine as the only option in general.
 *
 * Admin-guarded, not public, unlike fetch-once.ts's own reasoning for
 * staying a script ("an unauthenticated 'go fetch everything' route is
 * an obvious way to get affiliate credentials rate-limited by a
 * stranger") — AdminGuard closes exactly that gap, so this can safely
 * be an HTTP route instead of requiring shell access to the deployed
 * environment. Enqueues only; the actual fetch still runs through the
 * same per-retailer BullMQ queue (concurrency: 1, existing backoff/
 * retry rules) as the scheduled path — this never bypasses rate limits,
 * it only stops waiting for the clock.
 */
@Controller('admin/fetch')
@UseGuards(ApiAuthGuard, AdminGuard)
export class FetchTriggerController {
  constructor(private readonly fetcher: PriceFetchService) {}

  /** One retailer, e.g. after mapping new sneakers to it specifically. */
  @Post('trigger/:retailerSlug')
  async triggerOne(@Param('retailerSlug') retailerSlug: string) {
    if (!this.fetcher.activeSlugs().includes(retailerSlug)) {
      throw new NotFoundException({ error: 'not_found', message: `No active retailer '${retailerSlug}'.` });
    }
    const queued = await this.fetcher.enqueueAll(retailerSlug);
    return { retailerSlug, queued };
  }

  /** Every active retailer — the "just ran a catalog expansion migration" case. */
  @Post('trigger-all')
  async triggerAll() {
    const results: Array<{ retailerSlug: string; queued: number }> = [];
    for (const retailerSlug of this.fetcher.activeSlugs()) {
      results.push({ retailerSlug, queued: await this.fetcher.enqueueAll(retailerSlug) });
    }
    return { results };
  }
}
