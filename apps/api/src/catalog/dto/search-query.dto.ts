import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsIn(['good_time_to_buy', 'neutral', 'consider_waiting', 'insufficient_data'])
  signal?: string;

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
