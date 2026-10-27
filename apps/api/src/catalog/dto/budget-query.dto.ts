import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { BUDGET_LIMITS } from '../budget';

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
}
