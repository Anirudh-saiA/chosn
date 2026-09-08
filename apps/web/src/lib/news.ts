/** Mirrors apps/api/src/drops/news.service.ts's NewsListItem. */
export interface NewsListItem {
  id: string;
  title: string;
  body: string;
  source: string;
  sourceUrl: string | null;
  isBreaking: boolean;
  publishedAt: string;
  dropEventId: string | null;
  dropSneaker: { styleCode: string; brand: string; model: string } | null;
}

export interface NewsListResponse {
  items: NewsListItem[];
  total: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Never throws — an empty feed is a legitimate state (task 6), not a failed page. */
export async function fetchNewsList(
  params: { limit?: number; offset?: number; dropEventId?: string } = {},
  init?: RequestInit,
): Promise<NewsListResponse> {
  try {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.dropEventId) query.set('dropEventId', params.dropEventId);
    const qs = query.toString();
    const res = await fetch(`${API_URL}/news${qs ? `?${qs}` : ''}`, init);
    if (!res.ok) return { items: [], total: 0 };
    return (await res.json()) as NewsListResponse;
  } catch {
    return { items: [], total: 0 };
  }
}

export async function fetchNewsArticle(id: string, init?: RequestInit): Promise<NewsListItem | null> {
  try {
    const res = await fetch(`${API_URL}/news/${encodeURIComponent(id)}`, init);
    if (!res.ok) return null;
    return (await res.json()) as NewsListItem;
  } catch {
    return null;
  }
}

/** A short, word-boundary-respecting excerpt for list/feature cards — the API always returns full `body`, this is purely a display concern. */
export function excerpt(body: string, maxLength = 160): string {
  if (body.length <= maxLength) return body;
  const cut = body.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}
