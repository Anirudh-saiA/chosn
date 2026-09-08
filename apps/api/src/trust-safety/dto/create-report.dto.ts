import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const ENTITY_TYPES = ['user', 'post', 'comment', 'message'] as const;
const REASONS = ['harassment', 'doxxing', 'scam', 'hate_speech', 'spam', 'other'] as const;

/**
 * The body of the generic `reportEntity(type, id, reason, details)` API
 * (task 1) — deliberately the only shape any future reportable content
 * type needs to satisfy. A future community-posts feature calls this
 * exact endpoint with `reportedEntityType: 'post'`; it doesn't get its
 * own reporting system.
 */
export class CreateReportDto {
  @IsIn(ENTITY_TYPES)
  reportedEntityType!: (typeof ENTITY_TYPES)[number];

  @IsUUID()
  reportedEntityId!: string;

  @IsIn(REASONS)
  reason!: (typeof REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
