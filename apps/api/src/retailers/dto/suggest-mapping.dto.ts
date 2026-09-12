import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class MatchCandidateDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsString()
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productId?: string;
}

/**
 * A capped batch, not unbounded — this scores synchronously in-request
 * (see mapping-assist.service.ts's doc comment on why it stays that
 * way). 50 candidates is generously above what a human would paste in
 * from researching one sneaker across one retailer's search results.
 */
export class SuggestMappingDto {
  @IsUUID()
  sneakerId!: string;

  @IsUUID()
  retailerId!: string;

  @ValidateNested({ each: true })
  @Type(() => MatchCandidateDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  candidates!: MatchCandidateDto[];
}
