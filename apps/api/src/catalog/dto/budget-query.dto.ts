import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BUDGET_LIMITS, BUDGET_SORTS, TRENDING_DAYS, type BudgetSort } from '../budget';

/** GET /catalog/budget?max=5000&limit=12. Bad numbers are a clean 400, never reach SQL. */
export class BudgetQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(BUDGET_LIMITS.minMax)
  @Max(BUDGET_LIMITS.maxMax)
  max?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BUDGET_LIMITS.maxLimit)
  limit?: number;

  /** cheapest (default): lowest price first. popular: most stores first (2 or more). trending: most looked at and clicked recently, then most stores, then price. */
  @IsOptional()
  @IsIn(BUDGET_SORTS)
  sort?: BudgetSort;

  /** Days of views and Buy clicks counted by sort=trending, 1 to 7 (default 7). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(TRENDING_DAYS.min)
  @Max(TRENDING_DAYS.max)
  days?: number;
}
