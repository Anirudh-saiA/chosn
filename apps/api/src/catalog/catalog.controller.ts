import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { CatalogService, type CatalogResponse, type SearchResponse } from './catalog.service';
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
    return this.catalog.search(query);
  }

  /** Feeds Next's generateStaticParams() — see listVariantParams()'s doc comment. */
  @Get('variants')
  async listVariants(): Promise<{ styleCode: string; size: number }[]> {
    return this.catalog.listVariantParams();
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
