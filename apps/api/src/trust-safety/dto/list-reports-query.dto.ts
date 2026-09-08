import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const STATUSES = ['pending', 'reviewed', 'actioned', 'dismissed'] as const;

/** Same NaN-guarding convention as Day 16's other list-query DTOs (search-query.dto.ts et al.) — limit/offset go through `@Type(() => Number)` + `@IsInt()` before ever reaching a raw SQL LIMIT/OFFSET clause. */
export class ListReportsQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

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
