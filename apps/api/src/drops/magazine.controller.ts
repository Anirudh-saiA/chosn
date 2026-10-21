import { Controller, Get, Inject, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Response } from 'express';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import type { MagPage } from './magazine-logic';

const SLUG = /^\d{4}-(\d{2}-\d{2}|w\d{2})$/;
const API = () => (process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** Pictures we host are stored as relative /media paths; readers get full addresses. */
function absolutize<T>(v: T): T {
  if (typeof v === 'string') return (v.startsWith('/media/') ? `${API()}${v}` : v) as T;
  if (Array.isArray(v)) return v.map(absolutize) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, absolutize(x)])) as T;
  return v;
}

export interface IssueSummary {
  slug: string;
  kind: 'daily' | 'weekly';
  issueNo: number;
  title: string;
  periodStart: string;
  periodEnd: string;
  publishedAt: string;
  pageCount: number;
  coverHeadline: string | null;
  coverImage: string | null;
  hasPdf: boolean;
}

/** Read-only: the CHOSN Times issues (printed by scripts/build-magazine.ts) and their PDFs (scripts/render_magazine_pdf.py). */
@Controller('magazine')
export class MagazineController {
  private readonly dir = resolve(process.env.MEDIA_DIR ?? resolve(process.cwd(), '../../data/media'), 'magazine');

  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  @Get()
  async list(@Query('kind') kind?: string): Promise<IssueSummary[]> {
    const k = kind === 'daily' || kind === 'weekly' ? kind : null;
    const { rows } = await this.db.execute(sql`
      SELECT slug, kind, issue_no, title, period_start::text AS period_start, period_end::text AS period_end, published_at, jsonb_array_length(pages) AS n,
             pages -> 0 ->> 'headline' AS headline, pages -> 0 ->> 'image' AS image
        FROM magazine_issues ${k ? sql`WHERE kind = ${k}` : sql``} ORDER BY published_at DESC LIMIT 60`);
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      slug: String(r.slug),
      kind: r.kind as 'daily' | 'weekly',
      issueNo: Number(r.issue_no),
      title: String(r.title),
      periodStart: String(r.period_start),
      periodEnd: String(r.period_end),
      publishedAt: new Date(r.published_at as string).toISOString(),
      pageCount: Number(r.n),
      coverHeadline: (r.headline as string) ?? null,
      coverImage: absolutize((r.image as string) ?? null),
      hasPdf: existsSync(resolve(this.dir, `${String(r.slug)}.pdf`)),
    }));
  }

  @Get(':slug')
  async one(@Param('slug') slug: string): Promise<IssueSummary & { pages: MagPage[] }> {
    if (!SLUG.test(slug)) throw new NotFoundException();
    const { rows } = await this.db.execute(sql`
      SELECT slug, kind, issue_no, title, period_start::text AS period_start, period_end::text AS period_end, published_at, pages FROM magazine_issues WHERE slug = ${slug}`);
    const r = rows[0] as Record<string, unknown> | undefined;
    if (!r) throw new NotFoundException();
    const pages = absolutize(r.pages as MagPage[]);
    const cover = pages[0] as Extract<MagPage, { t: 'cover' }>;
    return {
      slug,
      kind: r.kind as 'daily' | 'weekly',
      issueNo: Number(r.issue_no),
      title: String(r.title),
      periodStart: String(r.period_start),
      periodEnd: String(r.period_end),
      publishedAt: new Date(r.published_at as string).toISOString(),
      pageCount: pages.length,
      coverHeadline: cover?.headline ?? null,
      coverImage: cover?.image ?? null,
      hasPdf: existsSync(resolve(this.dir, `${slug}.pdf`)),
      pages,
    };
  }

  /** The issue as a PDF, when it has been rendered. */
  @Get(':slug/pdf')
  pdf(@Param('slug') slug: string, @Res() res: Response): void {
    if (!SLUG.test(slug)) throw new NotFoundException();
    const path = resolve(this.dir, `${slug}.pdf`);
    if (!path.startsWith(this.dir) || !existsSync(path)) throw new NotFoundException();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="chosn-times-${slug}.pdf"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    createReadStream(path).pipe(res);
  }
}
