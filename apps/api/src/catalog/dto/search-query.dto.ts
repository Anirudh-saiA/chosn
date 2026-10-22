import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Day 16 task 5 (input validation audit) — real bug this DTO closes:
 * `catalog.service.ts`'s own clamping (`Math.min(Math.max(limit ?? 24, 1), 100)`)
 * silently breaks on a non-numeric `limit`, since `Number('abc')` is
 * `NaN`, and `NaN ?? 24` is still `NaN` — `??` only catches
 * `null`/`undefined`, not `NaN`. That `NaN` then reached a raw SQL
 * `LIMIT` clause and Postgres 500'd. Confirmed by actually calling
 * `GET /catalog/search?limit=abc` against the running API before
 * writing this fix, not assumed from reading the code.
 *
 * `@Type(() => Number)` + `@IsInt()` rejects that input here, before
 * the controller or service ever sees it — a clean 400, not a 500 two
 * layers down.
 */
export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  /** Comma-separated brand names. */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  brand?: string;

  /** Comma-separated retailer slugs. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  store?: string;

  /** Comma-separated colour families. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  minStores?: number;

  /** '1' includes shoes that are sold out everywhere. */
  @IsOptional()
  @IsIn(['1'])
  soldOut?: string;

  @IsOptional()
  @IsIn(['relevance', 'price_asc', 'price_desc', 'name_asc', 'name_desc', 'stores', 'outlook', 'newest'])
  sort?: string;

  @IsOptional()
  @IsIn(['good_time_to_buy', 'neutral', 'consider_waiting', 'insufficient_data'])
  signal?: string;

  /** Only shoes a store first listed in the last N days (the Releases page's "Just landed"). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  newDays?: number;

  /** The Buy now / Wait verdict (outlook_latest) the card shows for the chosen size. */
  @IsOptional()
  @IsIn(['buy_now', 'wait', 'fair'])
  outlook?: string;

  /** UK size: only shoes in stock in this size, with that size's own price and stores. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  size?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
