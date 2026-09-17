import { Body, Controller, Inject, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { IsUrl } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { sneakers } from '../db/schema';

/**
 * The curation path task 4 asks for. Deliberately a single endpoint,
 * not a full admin form — this codebase's own convention for a "not
 * built yet, real gap" area (see community-health.controller.ts's own
 * "deliberately not sophisticated" framing). Setting
 * sneakers.primary_image_url is the entire curation workflow; a
 * dedicated /admin UI page can wrap this later if hand-typing a curl
 * command turns out to be the actual bottleneck, not before.
 *
 * No image URLs are seeded by this change — see
 * docs/product-images.md's "Why nothing is curated yet" for why
 * hotlinking an unverified third-party retailer/brand image was a
 * real risk not worth taking without the account holder's sign-off,
 * same category of decision as Day 26's real licensed hero photo.
 */
class SetPrimaryImageDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl!: string;
}

@Controller('admin/catalog')
@UseGuards(ApiAuthGuard, AdminGuard)
export class AdminImageController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  @Post(':styleCode/image')
  async setPrimaryImage(@Param('styleCode') styleCode: string, @Body() dto: SetPrimaryImageDto) {
    const [row] = await this.db
      .update(sneakers)
      .set({ primaryImageUrl: dto.imageUrl, updatedAt: new Date() })
      .where(eq(sneakers.styleCode, styleCode))
      .returning({ id: sneakers.id, styleCode: sneakers.styleCode, primaryImageUrl: sneakers.primaryImageUrl });

    if (!row) throw new NotFoundException({ error: 'not_found', message: `No sneaker with style_code "${styleCode}".` });
    return row;
  }
}
