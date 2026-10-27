import { sql } from 'drizzle-orm';

/**
 * A snapshot that is real data, not a placeholder. Stores whose credentials were never approved are stored with a listing URL that
 * contains FIXTURE (see CatalogOffer.mode); those rows must never reach a price, an average or a shelf. Expects the snapshot aliased `ps`.
 * One definition so the readout (market intelligence) and the shelves cannot drift apart.
 */
export const REAL_LISTING = sql`ps.listing_url NOT LIKE '%FIXTURE%'`;
