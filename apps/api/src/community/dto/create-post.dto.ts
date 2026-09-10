import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const POST_TYPES = ['price_check', 'cop_or_drop', 'legit_check', 'drop_talk'] as const;

export class ChecklistItemDto {
  @IsString()
  @MaxLength(50)
  id!: string;

  @IsString()
  @MaxLength(120)
  label!: string;
}

/**
 * One DTO for all four post types, per-field validation conditioned on
 * `postType` via `@ValidateIf` rather than four separate DTO classes —
 * matches the single `posts` table's own "nullable type-specific
 * columns" shape (see schema.ts's header comment on this section), so
 * the validation layer and the storage layer agree on what each type
 * requires without duplicating the mapping between them.
 */
export class CreatePostDto {
  @IsIn(POST_TYPES)
  postType!: (typeof POST_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  /** price_check, cop_or_drop: required. */
  @ValidateIf((o: CreatePostDto) => o.postType === 'price_check' || o.postType === 'cop_or_drop')
  @IsUUID()
  sneakerVariantId?: string;

  /** drop_talk: required. Optional on the other three types. */
  @ValidateIf((o: CreatePostDto) => o.postType === 'drop_talk' || o.dropEventId !== undefined)
  @IsUUID()
  dropEventId?: string;

  /** legit_check: required, 1-8 items — configurable per post, not hardcoded (task 2). */
  @ValidateIf((o: CreatePostDto) => o.postType === 'legit_check')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  legitCheckChecklist?: ChecklistItemDto[];
}
