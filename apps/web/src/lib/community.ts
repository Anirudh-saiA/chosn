import type { MarketIntelligence } from './catalog';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type PostType = 'price_check' | 'cop_or_drop' | 'legit_check' | 'drop_talk';

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface PostImage {
  id: string;
  url: string;
  checklistItemId: string | null;
  classifierStatus: string;
}

export interface PollResults {
  cop: number;
  drop: number;
  total: number;
  viewerChoice: 'cop' | 'drop' | null;
}

export interface Post {
  id: string;
  postType: PostType;
  title: string | null;
  body: string | null;
  authorUserId: string;
  authorDisplayName: string | null;
  authorAvatarSeed: string;
  createdAt: string;
  commentCount: number;
  voteScore: number;
  viewerVote: 1 | -1 | null;
  sneaker: { styleCode: string; brand: string; model: string; colorway: string } | null;
  variant: { id: string; size: string; sizeSystem: string } | null;
  marketIntelligence: MarketIntelligence | null;
  pollResults: PollResults | null;
  legitCheckChecklist: ChecklistItem[] | null;
  images: PostImage[] | null;
  dropEvent: { id: string; releaseDate: string; status: string } | null;
}

export interface Comment {
  id: string;
  postId: string;
  authorUserId: string;
  authorDisplayName: string | null;
  authorAvatarSeed: string;
  body: string;
  createdAt: string;
}

function authHeaders(apiToken?: string): HeadersInit {
  return apiToken ? { Authorization: `Bearer ${apiToken}` } : {};
}

export async function listPosts(
  params: { postType?: PostType; dropEventId?: string; limit?: number } = {},
  apiToken?: string,
): Promise<Post[]> {
  const qs = new URLSearchParams();
  if (params.postType) qs.set('postType', params.postType);
  if (params.dropEventId) qs.set('dropEventId', params.dropEventId);
  if (params.limit) qs.set('limit', String(params.limit));
  const res = await fetch(`${API_URL}/community/posts?${qs}`, {
    headers: authHeaders(apiToken),
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const body = await res.json();
  return body.posts ?? [];
}

export async function getPost(id: string, apiToken?: string): Promise<Post | null> {
  const res = await fetch(`${API_URL}/community/posts/${id}`, { headers: authHeaders(apiToken), cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()).post ?? null;
}

export interface CreatePostInput {
  postType: PostType;
  title?: string;
  body?: string;
  sneakerVariantId?: string;
  dropEventId?: string;
  legitCheckChecklist?: ChecklistItem[];
}

export async function createPost(
  apiToken: string,
  input: CreatePostInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const res = await fetch(`${API_URL}/community/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    return { ok: false, message: message ?? 'Could not create post.' };
  }
  return { ok: true, id: body.post.id };
}

export async function uploadPostImage(
  apiToken: string,
  postId: string,
  file: File,
  checklistItemId?: string,
): Promise<PostImage | null> {
  const form = new FormData();
  form.append('file', file);
  if (checklistItemId) form.append('checklistItemId', checklistItemId);
  const res = await fetch(`${API_URL}/community/posts/${postId}/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}` },
    body: form,
  });
  if (!res.ok) return null;
  return (await res.json()).image ?? null;
}

export async function castVote(
  apiToken: string,
  votableType: 'post' | 'comment',
  votableId: string,
  value: 1 | -1 | 0,
): Promise<number | null> {
  const res = await fetch(`${API_URL}/community/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ votableType, votableId, value }),
  });
  if (!res.ok) return null;
  return (await res.json()).voteScore ?? null;
}

export async function castPollVote(
  apiToken: string,
  postId: string,
  choice: 'cop' | 'drop',
): Promise<PollResults | null> {
  const res = await fetch(`${API_URL}/community/posts/${postId}/poll-vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ choice }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return { cop: body.cop, drop: body.drop, total: body.cop + body.drop, viewerChoice: choice };
}

export async function listComments(postId: string): Promise<Comment[]> {
  const res = await fetch(`${API_URL}/community/posts/${postId}/comments`, { cache: 'no-store' });
  if (!res.ok) return [];
  return (await res.json()).comments ?? [];
}

export async function createComment(apiToken: string, postId: string, body: string): Promise<Comment | null> {
  const res = await fetch(`${API_URL}/community/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) return null;
  return (await res.json()).comment ?? null;
}

// ---------------------------------------------------------------- catalog search (composer)

export interface SearchResultItem {
  styleCode: string;
  brand: string;
  model: string;
  colorway: string;
  primaryImageUrl: string | null;
  defaultSize: number;
}

export async function searchSneakers(q: string): Promise<SearchResultItem[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${API_URL}/catalog/search?q=${encodeURIComponent(q)}&limit=8`, { cache: 'no-store' });
  if (!res.ok) return [];
  return (await res.json()).results ?? [];
}

/** Resolves a search result's (styleCode, defaultSize) to the real sneaker_variant id the composer actually needs — search results describe a sneaker, not a specific variant row. */
export async function resolveVariantId(styleCode: string, size: number): Promise<string | null> {
  const res = await fetch(`${API_URL}/catalog/${encodeURIComponent(styleCode)}/${size}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()).variant?.id ?? null;
}
