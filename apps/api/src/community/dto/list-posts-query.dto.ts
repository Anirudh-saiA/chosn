import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const POST_TYPES = ['price_check', 'cop_or_drop', 'legit_check', 'drop_talk'] as const;

export class ListPostsQueryDto {
  @IsOptional()
  @IsIn(POST_TYPES)
  postType?: (typeof POST_TYPES)[number];

  @IsOptional()
  @IsUUID()
  dropEventId?: string;

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
}
