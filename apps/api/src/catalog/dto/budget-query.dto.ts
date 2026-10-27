import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BUDGET_LIMITS, BUDGET_SORTS, type BudgetSort } from '../budget';

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

  /** cheapest (default): lowest price first. popular: shoes sold at the most stores first, only shoes at 2 or more stores. */
  @IsOptional()
  @IsIn(BUDGET_SORTS)
  sort?: BudgetSort;
}
