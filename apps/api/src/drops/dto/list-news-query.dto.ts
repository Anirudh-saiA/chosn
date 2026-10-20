import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

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

  /** '1' = only stories gathered from other sites' feeds, '0' = only our own. */
  @IsOptional()
  @IsIn(['0', '1'])
  external?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  brand?: string;

  @IsOptional()
  @IsIn(['release', 'collab', 'culture', 'industry'])
  category?: string;

  /** 'relevance' = top stories first; the default is newest first. */
  @IsOptional()
  @IsIn(['latest', 'relevance'])
  sort?: string;
}
