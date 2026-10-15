import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import {
  CatalogService,
  type CatalogResponse,
  type CompareItem,
  type PriceHistory,
  type SearchResponse,
  type SearchSort,
  type SearchResultItem,
} from './catalog.service';
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
