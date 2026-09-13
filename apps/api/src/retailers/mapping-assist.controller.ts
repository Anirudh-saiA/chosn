import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AdminGuard } from '../auth/admin.guard';
import { ApiAuthGuard, type AuthenticatedRequest } from '../auth/api-auth.guard';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { retailerProductMappings, sneakers } from '../db/schema';
import { ConfirmMappingDto } from './dto/confirm-mapping.dto';
import { SuggestMappingDto } from './dto/suggest-mapping.dto';
import { MappingAssistService } from './mapping-assist.service';

/**
 * Day 28 (retroactively Day 8) — admin-only, same guard pairing and
 * placement convention as community-health.controller.ts. Not exposed to
 * retailers or the public: this ranks candidate titles a human already
 * collected and writes retailer_product_mappings on explicit confirm,
 * nothing more.
 */
@Controller('admin/mapping-assist')
@UseGuards(ApiAuthGuard, AdminGuard)
export class MappingAssistController {
  constructor(
    private readonly assist: MappingAssistService,
    @Inject(DRIZZLE) private readonly db: Db,
  ) {}

  @Post('suggest')
  async suggest(@Body() dto: SuggestMappingDto) {
    const [target] = await this.db
      .select({
        brand: sneakers.brand,
        model: sneakers.model,
        silhouette: sneakers.silhouette,
        colorway: sneakers.colorway,
        styleCode: sneakers.styleCode,
      })
      .from(sneakers)
      .where(eq(sneakers.id, dto.sneakerId))
      .limit(1);

    if (!target) throw new NotFoundException({ error: 'not_found', message: 'No sneaker with that id.' });

    const suggestions = this.assist.suggestMatches(target, dto.candidates);
    return { target, suggestions };
  }

  @Post('confirm')
  async confirm(@Body() dto: ConfirmMappingDto, @Req() req: AuthenticatedRequest) {
    const [sneaker] = await this.db
      .select({ id: sneakers.id, styleCode: sneakers.styleCode })
      .from(sneakers)
      .where(eq(sneakers.id, dto.sneakerId))
      .limit(1);
    if (!sneaker) throw new NotFoundException({ error: 'not_found', message: 'No sneaker with that id.' });
    if (sneaker.styleCode !== dto.styleCode) {
      // Catches exactly the mistake this whole flow exists to prevent —
      // confirming a suggestion against the wrong sneaker because two
      // browser tabs got crossed. styleCode is denormalized onto the
      // mapping row specifically so it's re-checked here, not just
      // trusted from the sneakerId foreign key.
      throw new BadRequestException({
        error: 'style_code_mismatch',
        message: `Submitted styleCode ${dto.styleCode} doesn't match sneaker ${sneaker.id} (${sneaker.styleCode}).`,
      });
    }

    const [row] = await this.db
      .insert(retailerProductMappings)
      .values({
        retailerId: dto.retailerId,
        sneakerId: dto.sneakerId,
        sneakerVariantId: dto.sneakerVariantId,
        retailerRawTitle: dto.retailerRawTitle,
        retailerProductUrl: dto.retailerProductUrl,
        styleCode: dto.styleCode,
        retailerProductId: dto.retailerProductId,
        mappingConfidence: dto.mappingConfidence,
        mappedBy: req.user?.userId ?? 'unknown',
        notes: dto.notes,
      })
      .onConflictDoUpdate({
        target: [retailerProductMappings.retailerId, retailerProductMappings.sneakerId],
        set: {
          sneakerVariantId: dto.sneakerVariantId,
          retailerRawTitle: dto.retailerRawTitle,
          retailerProductUrl: dto.retailerProductUrl,
          retailerProductId: dto.retailerProductId,
          mappingConfidence: dto.mappingConfidence,
          mappedBy: req.user?.userId ?? 'unknown',
          notes: dto.notes,
          mappedAt: new Date(),
        },
      })
      .returning();

    return row;
  }
}
