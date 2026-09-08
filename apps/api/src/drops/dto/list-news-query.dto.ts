import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Same class of fix as catalog/search and drops list — see those DTOs' own comments. `dropEventId` reaches a raw `WHERE n.drop_event_id = $1` UUID-column comparison; unvalidated, a garbage value 500s instead of 400ing. */
export class ListNewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsUUID()
  dropEventId?: string;
}
