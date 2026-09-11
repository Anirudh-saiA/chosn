import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Db } from '../db/drizzle.provider';
import { posts } from '../db/schema';
import { BlocksService } from '../trust-safety/blocks.service';
import { MarketIntelligenceService } from '../pricing/market-intelligence.service';
import { LEGIT_CHECK_MIN_REPUTATION, ReputationService } from '../reputation/reputation.service';
import { CommunityNotificationsService } from './community-notifications.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';

export interface PostSummary {
  id: string;
  postType: string;
  title: string | null;
  body: string | null;
  authorUserId: string;
  authorDisplayName: string | null;
  authorAvatarSeed: string;
  authorReputationScore: number;
  createdAt: string;
  commentCount: number;
  voteScore: number;
  viewerVote: 1 | -1 | null;
  // price_check / cop_or_drop
  sneaker: { styleCode: string; brand: string; model: string; colorway: string } | null;
  variant: { id: string; size: string; sizeSystem: string } | null;
  marketIntelligence: unknown | null;
  pollResults: { cop: number; drop: number; total: number; viewerChoice: 'cop' | 'drop' | null } | null;
  // legit_check
  legitCheckChecklist: { id: string; label: string }[] | null;
  images: { id: string; url: string; checklistItemId: string | null; classifierStatus: string }[] | null;
  // drop_talk
  dropEvent: { id: string; releaseDate: string; status: string } | null;
}

/**
 * The generic post-type template (task 4): one query shape returns all
 * four post types, each carrying only the fields its own type actually
 * uses — the feed and each display component branch on `postType`
 * client-side, the API doesn't have four different response shapes to
 * keep in sync.
 */
@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly blocks: BlocksService,
    private readonly marketIntelligence: MarketIntelligenceService,
    private readonly reputation: ReputationService,
    private readonly communityNotifications: CommunityNotificationsService,
  ) {}

  async create(authorUserId: string, dto: CreatePostDto): Promise<{ id: string }> {
    if (dto.postType === 'legit_check') {
      const ids = new Set((dto.legitCheckChecklist ?? []).map((i) => i.id));
      if (ids.size !== (dto.legitCheckChecklist ?? []).length) {
        throw new BadRequestException({ error: 'invalid_checklist', message: 'Checklist item ids must be unique.' });
      }

      // Day 23, task 2's gate — see LEGIT_CHECK_MIN_REPUTATION's own doc
      // comment for the threshold and why only this post type is gated.
      const rep = await this.reputation.getForUser(authorUserId);
      if ((rep?.score ?? 0) < LEGIT_CHECK_MIN_REPUTATION) {
        throw new ForbiddenException({
          error: 'reputation_too_low',
          message: `Posting a Legit Check needs a little more standing on CHOSN first (score ${rep?.score ?? 0}/${LEGIT_CHECK_MIN_REPUTATION}) — comment or post elsewhere, or just give your account a few days, and this unlocks.`,
        });
      }
    }

    const [row] = await this.db
      .insert(posts)
      .values({
        authorUserId,
        postType: dto.postType,
        title: dto.title ?? null,
        body: dto.body ?? null,
        sneakerVariantId: dto.sneakerVariantId ?? null,
        dropEventId: dto.dropEventId ?? null,
        legitCheckChecklist: dto.legitCheckChecklist ?? null,
      })
      .returning({ id: posts.id });

    // Day 24 task 2 — @mentions in a brand new post's title/body. No
    // "reply" case here (there's nothing this post is replying to yet).
    const mentionText = [dto.title, dto.body].filter(Boolean).join(' ');
    if (mentionText) {
      try {
        await this.communityNotifications.notifyMentions({
          text: mentionText,
          actorUserId: authorUserId,
          entityType: 'post',
          entityId: row!.id,
          postId: row!.id,
        });
      } catch (err) {
        this.logger.warn(`mention notification dispatch failed for post ${row!.id}: ${(err as Error).message}`);
      }
    }

    return row!;
  }

  async list(query: ListPostsQueryDto, viewerUserId: string | null): Promise<{ posts: PostSummary[] }> {
    const excludedAuthors = viewerUserId ? await this.blocks.blockedUserIds(viewerUserId) : [];
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const result = await this.db.execute(sql`
      SELECT
        p.id, p.post_type, p.title, p.body, p.author_user_id, p.created_at,
        u.display_name AS author_display_name, u.avatar_seed AS author_avatar_seed,
        COALESCE(ur.score, 0) AS author_reputation_score,
        p.legit_check_checklist,
        s.style_code, s.brand, s.model, s.colorway,
        v.id AS variant_id, v.size, v.size_system,
        de.id AS drop_event_id, de.release_date, de.status AS drop_event_status,
        COALESCE(cc.comment_count, 0) AS comment_count,
        COALESCE(vs.vote_score, 0) AS vote_score,
        vv.value AS viewer_vote,
        COALESCE(pv.cop_count, 0) AS poll_cop_count,
        COALESCE(pv.drop_count, 0) AS poll_drop_count,
        upv.choice AS viewer_poll_choice
      FROM posts p
      JOIN users u ON u.id = p.author_user_id
      LEFT JOIN user_reputation ur ON ur.user_id = p.author_user_id
      LEFT JOIN sneaker_variants v ON v.id = p.sneaker_variant_id
      LEFT JOIN sneakers s ON s.id = v.sneaker_id
      LEFT JOIN drop_events de ON de.id = p.drop_event_id
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS comment_count FROM comments c WHERE c.post_id = p.id AND c.is_removed = false
      ) cc ON true
      LEFT JOIN LATERAL (
        SELECT coalesce(sum(value), 0)::int AS vote_score FROM votes vt WHERE vt.votable_type = 'post' AND vt.votable_id = p.id
      ) vs ON true
      LEFT JOIN votes vv ON vv.votable_type = 'post' AND vv.votable_id = p.id AND vv.user_id = ${viewerUserId}
      LEFT JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE choice = 'cop')::int AS cop_count,
          count(*) FILTER (WHERE choice = 'drop')::int AS drop_count
        FROM poll_votes pv2 WHERE pv2.post_id = p.id
      ) pv ON p.post_type = 'cop_or_drop'
      LEFT JOIN poll_votes upv ON upv.post_id = p.id AND upv.user_id = ${viewerUserId}
      WHERE p.is_removed = false
        ${query.postType ? sql`AND p.post_type = ${query.postType}` : sql``}
        ${query.dropEventId ? sql`AND p.drop_event_id = ${query.dropEventId}` : sql``}
        ${query.authorUserId ? sql`AND p.author_user_id = ${query.authorUserId}` : sql``}
        ${excludedAuthors.length > 0 ? sql`AND p.author_user_id NOT IN (${sql.join(excludedAuthors, sql`, `)})` : sql``}
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const rows = result.rows as Record<string, unknown>[];
    const legitCheckIds = rows.filter((r) => r.post_type === 'legit_check').map((r) => String(r.id));
    const imagesByPost = await this.imagesFor(legitCheckIds);

    const summaries = await Promise.all(rows.map((r) => this.toSummary(r, imagesByPost)));
    return { posts: summaries };
  }

  async get(id: string, viewerUserId: string | null): Promise<PostSummary> {
    const result = await this.singlePostQuery(id, viewerUserId);
    if (!result) throw new NotFoundException({ error: 'not_found', message: 'Post not found.' });
    return result;
  }

  private async singlePostQuery(id: string, viewerUserId: string | null): Promise<PostSummary | null> {
    const result = await this.db.execute(sql`
      SELECT
        p.id, p.post_type, p.title, p.body, p.author_user_id, p.created_at,
        u.display_name AS author_display_name, u.avatar_seed AS author_avatar_seed,
        COALESCE(ur.score, 0) AS author_reputation_score,
        p.legit_check_checklist,
        s.style_code, s.brand, s.model, s.colorway,
        v.id AS variant_id, v.size, v.size_system,
        de.id AS drop_event_id, de.release_date, de.status AS drop_event_status,
        COALESCE(cc.comment_count, 0) AS comment_count,
        COALESCE(vs.vote_score, 0) AS vote_score,
        vv.value AS viewer_vote,
        COALESCE(pv.cop_count, 0) AS poll_cop_count,
        COALESCE(pv.drop_count, 0) AS poll_drop_count,
        upv.choice AS viewer_poll_choice
      FROM posts p
      JOIN users u ON u.id = p.author_user_id
      LEFT JOIN user_reputation ur ON ur.user_id = p.author_user_id
      LEFT JOIN sneaker_variants v ON v.id = p.sneaker_variant_id
      LEFT JOIN sneakers s ON s.id = v.sneaker_id
      LEFT JOIN drop_events de ON de.id = p.drop_event_id
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS comment_count FROM comments c WHERE c.post_id = p.id AND c.is_removed = false
      ) cc ON true
      LEFT JOIN LATERAL (
        SELECT coalesce(sum(value), 0)::int AS vote_score FROM votes vt WHERE vt.votable_type = 'post' AND vt.votable_id = p.id
      ) vs ON true
      LEFT JOIN votes vv ON vv.votable_type = 'post' AND vv.votable_id = p.id AND vv.user_id = ${viewerUserId}
      LEFT JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE choice = 'cop')::int AS cop_count,
          count(*) FILTER (WHERE choice = 'drop')::int AS drop_count
        FROM poll_votes pv2 WHERE pv2.post_id = p.id
      ) pv ON p.post_type = 'cop_or_drop'
      LEFT JOIN poll_votes upv ON upv.post_id = p.id AND upv.user_id = ${viewerUserId}
      WHERE p.id = ${id} AND p.is_removed = false
    `);
    const row = (result.rows as Record<string, unknown>[])[0];
    if (!row) return null;
    const images = row.post_type === 'legit_check' ? (await this.imagesFor([id]))[id] ?? [] : null;
    return this.toSummary(row, images ? { [id]: images } : {});
  }

  private async imagesFor(postIds: string[]): Promise<Record<string, PostSummary['images']>> {
    if (postIds.length === 0) return {};
    const result = await this.db.execute(sql`
      SELECT id, post_id, url, checklist_item_id, classifier_status
      FROM post_images WHERE post_id IN (${sql.join(postIds.map((id) => sql`${id}`), sql`, `)})
      ORDER BY created_at ASC
    `);
    const byPost: Record<string, NonNullable<PostSummary['images']>> = {};
    for (const r of result.rows as Record<string, unknown>[]) {
      const postId = String(r.post_id);
      (byPost[postId] ??= []).push({
        id: String(r.id),
        url: String(r.url),
        checklistItemId: (r.checklist_item_id as string | null) ?? null,
        classifierStatus: String(r.classifier_status),
      });
    }
    return byPost;
  }

  private async toSummary(
    r: Record<string, unknown>,
    imagesByPost: Record<string, PostSummary['images']>,
  ): Promise<PostSummary> {
    const postType = String(r.post_type);
    const variantId = r.variant_id ? String(r.variant_id) : null;

    let marketIntelligence: unknown | null = null;
    if (postType === 'price_check' && variantId) {
      marketIntelligence = await this.marketIntelligence.getCached(variantId);
    }

    return {
      id: String(r.id),
      postType,
      title: (r.title as string | null) ?? null,
      body: (r.body as string | null) ?? null,
      authorUserId: String(r.author_user_id),
      authorDisplayName: (r.author_display_name as string | null) ?? null,
      authorAvatarSeed: String(r.author_avatar_seed),
      authorReputationScore: Number(r.author_reputation_score ?? 0),
      createdAt: new Date(r.created_at as string).toISOString(),
      commentCount: Number(r.comment_count),
      voteScore: Number(r.vote_score),
      viewerVote: r.viewer_vote === null || r.viewer_vote === undefined ? null : (Number(r.viewer_vote) as 1 | -1),
      sneaker: r.style_code
        ? { styleCode: String(r.style_code), brand: String(r.brand), model: String(r.model), colorway: String(r.colorway) }
        : null,
      variant: variantId ? { id: variantId, size: String(r.size), sizeSystem: String(r.size_system) } : null,
      marketIntelligence,
      pollResults:
        postType === 'cop_or_drop'
          ? {
              cop: Number(r.poll_cop_count),
              drop: Number(r.poll_drop_count),
              total: Number(r.poll_cop_count) + Number(r.poll_drop_count),
              viewerChoice: (r.viewer_poll_choice as 'cop' | 'drop' | null) ?? null,
            }
          : null,
      legitCheckChecklist: (r.legit_check_checklist as { id: string; label: string }[] | null) ?? null,
      images: postType === 'legit_check' ? imagesByPost[String(r.id)] ?? [] : null,
      dropEvent: r.drop_event_id
        ? {
            id: String(r.drop_event_id),
            releaseDate: String(r.release_date),
            status: String(r.drop_event_status),
          }
        : null,
    };
  }
}
