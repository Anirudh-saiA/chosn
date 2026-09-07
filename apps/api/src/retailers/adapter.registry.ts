import { AdmitadAdapter } from './admitad/admitad.adapter';
import { AwinAdapter } from './awin/awin.adapter';
import { FlipkartAdapter } from './flipkart/flipkart.adapter';
import { InrdealsAdapter } from './inrdeals/inrdeals.adapter';
import { ManualPriceAdapter } from './manual/manual-price.adapter';
import type { RetailerAdapter } from './retailer-adapter.interface';

export const RETAILER_ADAPTERS = 'RETAILER_ADAPTERS';

/**
 * Every slug-specific adapter, collected in one place.
 *
 * Day 6 hard-coded Flipkart into PriceFetchService's constructor, which
 * would have meant editing that service for each of the ten sources. Now
 * adding a retailer is: write the adapter, add it to this array, add a
 * row to the retailers table. The queue, worker, retry, dead-letter and
 * health wiring is all slug-driven and never changes.
 *
 * ManualPriceAdapter is deliberately not here — it isn't bound to a slug.
 * It serves any retailer whose integration_type is 'manual', so the two
 * Tier 2 boutiques (and any added later) share one implementation rather
 * than needing a near-empty class each.
 */
export const retailerAdaptersProvider = {
  provide: RETAILER_ADAPTERS,
  inject: [FlipkartAdapter, AdmitadAdapter, InrdealsAdapter, AwinAdapter],
  useFactory: (...adapters: RetailerAdapter[]): RetailerAdapter[] => adapters,
};

export const RETAILER_ADAPTER_CLASSES = [
  FlipkartAdapter,
  AdmitadAdapter,
  InrdealsAdapter,
  AwinAdapter,
  ManualPriceAdapter,
];
