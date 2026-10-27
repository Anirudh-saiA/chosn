import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import {
  CatalogService,
  type CatalogResponse,
  type ColourOption,
  type CompareItem,
  type PriceHistory,
  type SearchResponse,
  type SearchSort,
  type PriceDrop,
  type StoreDiscount,
  type StoreSummary,
  type SearchResultItem,
} from './catalog.service';
import { clampTrendingDays, type BudgetItem, type BudgetRanking } from './budget';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';

/**
 * The one endpoint Day 10's price comparison page calls server-side:
 * variant metadata, sibling sizes for the size selector, every
 * retailer's current listing, and the Market Intelligence summary — one
 * round trip, so the page has no waterfall of sequential fetches.
 *
 * :size is a path segment, not a query param, so the canonical URL for
 * each size is itself indexable (Day 10 task 2) rather than living
 * behind a query string search engines are less likely to crawl fully.
 */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * Day 11 search/browse. `search` is a fixed one-segment path, `:size`
   * below needs two — no route-order ambiguity to worry about, but it's
   * declared first anyway (a static route before a dynamic one) as the
   * convention that stays unambiguous if either route ever changes shape.
   */
  @Get('search')
  async search(@Query() query: SearchQueryDto): Promise<SearchResponse> {
    const { soldOut, sort, ...rest } = query;
    return this.catalog.search({
      ...rest,
      includeSoldOut: soldOut === '1',
      sort: sort as SearchSort | undefined,
    });
  }

  /** Biggest discounts by the store's own "was" price. */
  @Get('discounts')
  async discounts(@Query('limit') limit?: string, @Query('minPct') minPct?: string): Promise<StoreDiscount[]> {
    const l = Math.min(Math.max(Number(limit) || 24, 1), 100);
    const m = Math.min(Math.max(Number(minPct) || 20, 10), 70);
    return this.catalog.discounts(l, m);
  }

  /**
   * The budget shelf: /catalog/budget?max=5000&limit=12[&sort=cheapest|popular|trending][&days=7]. Each shoe's cheapest eligible offer at or under `max`
   * rupees, one card per model, with that store's offers and delivery estimate. sort=popular: most stores first (2 or more). sort=trending: most looked
   * at and clicked over the last `days` days (1 to 7), then most stores, then price. `ranking` says which order produced the list.
   */
  @Get('budget')
  async budget(@Query() q: BudgetQueryDto): Promise<{ max: number; sort: string; ranking: BudgetRanking; days: number | null; items: BudgetItem[] }> {
    const sort = q.sort ?? 'cheapest';
    const { ranking, items } = await this.catalog.budget(q.max, q.limit, sort, q.days);
    return { max: q.max ?? 5000, sort, ranking, days: sort === 'trending' ? clampTrendingDays(q.days) : null, items };
  }

  /** "Crazy falls": the biggest recorded price falls since the previous recorded day. */
  @Get('price-drops')
  async priceDrops(@Query('limit') limit?: string, @Query('minPct') minPct?: string): Promise<PriceDrop[]> {
    const l = Math.min(Math.max(Number(limit) || 24, 1), 100);
    const m = Math.min(Math.max(Number(minPct) || 15, 5), 70);
    return this.catalog.priceDrops(l, m);
  }

  /** The "Stores we compare" page: every live store with how many shoes it has and when it was last read. */
  @Get('stores')
  async stores(): Promise<StoreSummary> {
    return this.catalog.storeSummary();
  }

  /** Feeds Next's generateStaticParams() — see listVariantParams()'s doc comment. */
  @Get('variants')
  async listVariants(): Promise<{ styleCode: string; size: number }[]> {
    return this.catalog.listVariantParams();
  }

  /** Side-by-side compare: /catalog/compare?styles=DD1391-100,CW2288-111 (up to four). */
  @Get('compare')
  async compare(@Query('styles') styles?: string): Promise<{ items: CompareItem[] }> {
    return { items: await this.catalog.compare((styles ?? '').split(',')) };
  }

  /** Colourways of the same model, for the colour picker: /catalog/DD1391-100/colours */
  /** How many shoppers viewed this shoe and which stores they chose (anonymous counts, recent days). */
  @Get(':styleCode/choices')
  async choices(@Param('styleCode') styleCode: string, @Query('days') days?: string) {
    return this.catalog.choices(styleCode, Math.min(Math.max(Number(days) || 90, 7), 365));
  }

  /** Sizes, stores and prices for one colour, for the card when it switches to a colour it was not sent. */
  @Get(':styleCode/card')
  async cardData(@Param('styleCode') styleCode: string) {
    return this.catalog.cardData(styleCode);
  }

  /** Photos of one shoe for the card's photo buttons. */
  @Get(':styleCode/photos')
  async photos(@Param('styleCode') styleCode: string): Promise<{ photos: string[] }> {
    return this.catalog.photos(styleCode);
  }

  @Get(':styleCode/colours')
  async colours(@Param('styleCode') styleCode: string): Promise<{ colours: ColourOption[] }> {
    return { colours: await this.catalog.colours(styleCode) };
  }

  /** Similar shoes for the product page's side rail. Declared before :styleCode/:size so "similar" isn't read as a size. */
  @Get(':styleCode/similar')
  async similar(
    @Param('styleCode') styleCode: string,
    @Query('limit') limit?: string,
  ): Promise<{ results: SearchResultItem[] }> {
    return { results: await this.catalog.similar(styleCode, limit ? Number(limit) || 8 : 8) };
  }

  /** Real recorded prices per day: /catalog/DD1391-100/9/history?days=90 */
  @Get(':styleCode/:size/history')
  async history(
    @Param('styleCode') styleCode: string,
    @Param('size') size: string,
    @Query('days') days?: string,
  ): Promise<PriceHistory> {
    const parsedSize = Number(size);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) throw new NotFoundException(`Invalid size "${size}"`);
    return this.catalog.priceHistory(styleCode, parsedSize, days ? Number(days) || 90 : 90);
  }

  @Get(':styleCode/:size')
  async getVariant(
    @Param('styleCode') styleCode: string,
    @Param('size') size: string,
  ): Promise<CatalogResponse> {
    const parsedSize = Number(size);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      // NotFoundException rather than 400: a malformed size in the URL
      // is indistinguishable from "this page doesn't exist" to a
      // crawler or a mistyped link, and 404 is the correct signal for
      // both — no route on this page ever legitimately has a non-numeric
      // size segment.
      throw new NotFoundException(`Invalid size "${size}"`);
    }
    return this.catalog.getVariantPage(styleCode, parsedSize);
  }
}
