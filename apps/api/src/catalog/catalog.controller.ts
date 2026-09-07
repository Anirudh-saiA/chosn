import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CatalogService, type CatalogResponse } from './catalog.service';

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
