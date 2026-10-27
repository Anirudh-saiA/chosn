import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { sql } from 'drizzle-orm';
import { AdminGuard } from '../auth/admin.guard';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { DRIZZLE, type Db } from '../db/drizzle.provider';

const TYPES = ['sneaker', 'slide', 'sandal', 'other'] as const;
type FootwearTypeName = (typeof TYPES)[number];

export class SetFootwearTypeDto {
  @IsIn(TYPES)
  footwearType!: FootwearTypeName;
}

/**
 * The admin way to see and correct what the public pages hide (migration 0050). A correction is marked manual, so the rule never overrides it
 * later. The shoe appears or disappears on the public pages after the next catalogue-view refresh (the hourly refresh, or the nightly import).
 */
@Controller('admin/catalog')
@UseGuards(ApiAuthGuard, AdminGuard)
export class AdminFootwearController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** GET /admin/catalog/hidden?type=slide|sandal|other&limit=100 : the hidden shoes, a few at a time. */
  @Get('hidden')
  async hidden(@Query('type') type?: string, @Query('limit') limit?: string) {
    const t = TYPES.find((x) => x === type && x !== 'sneaker');
    const n = Math.min(Math.max(Math.floor(Number(limit)) || 100, 1), 500);
    const { rows } = await this.db.execute(sql`
      SELECT style_code, brand, model, silhouette, colorway, footwear_type, footwear_type_manual
      FROM sneakers WHERE ${t ? sql`footwear_type = ${t}` : sql`footwear_type <> 'sneaker'`}
      ORDER BY brand, model, style_code LIMIT ${n}`);
    return { items: rows };
  }

  /** POST /admin/catalog/:styleCode/footwear-type {"footwearType":"sneaker"} : show or hide one shoe, and keep it that way. */
  @Post(':styleCode/footwear-type')
  async setType(@Param('styleCode') styleCode: string, @Body() dto: SetFootwearTypeDto) {
    const { rows } = await this.db.execute(sql`
      UPDATE sneakers SET footwear_type = ${dto.footwearType}::footwear_type, footwear_type_manual = true, updated_at = now()
      WHERE style_code = ${styleCode}
      RETURNING style_code, footwear_type, footwear_type_manual`);
    if (rows.length === 0) throw new NotFoundException({ error: 'not_found', message: `No sneaker with style_code "${styleCode}".` });
    return rows[0];
  }
}
