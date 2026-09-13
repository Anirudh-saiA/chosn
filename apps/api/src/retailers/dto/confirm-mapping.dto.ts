import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * The human-confirmation step — nothing reaches retailer_product_mappings
 * without a POST here. `mappingConfidence` is caller-supplied rather than
 * inferred server-side from a score: the whole point of task 3's
 * "still requires human confirmation" is that a person is asserting this,
 * not the algorithm. A 'fuzzy' confirmation still means "a human looked
 * at the suggestion and accepted it" — it's the mapping's provenance
 * label, not a bypass of review.
 */
export class ConfirmMappingDto {
  @IsUUID()
  retailerId!: string;

  @IsUUID()
  sneakerId!: string;

  @IsOptional()
  @IsUUID()
  sneakerVariantId?: string;

  @IsString()
  @MaxLength(300)
  retailerRawTitle!: string;

  @IsString()
  @MaxLength(500)
  retailerProductUrl!: string;

  @IsString()
  @MaxLength(50)
  styleCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  retailerProductId?: string;

  @IsIn(['manual', 'verified', 'fuzzy'])
  mappingConfidence!: 'manual' | 'verified' | 'fuzzy';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
