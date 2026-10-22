/** Mirrors apps/api/src/drops/magazine-logic.ts and magazine.controller.ts. */
export interface StoryRef {
  id: string;
  title: string;
  deck: string;
  source: string;
  kicker: string | null;
  image: string | null;
  imageCredit: string | null;
  imageStyle: 'product' | 'photo' | null;
  imageRatio: number | null;
  href: string;
  external: boolean;
  publishedAt: string;
  india: boolean;
  shoeQuery: string | null;
  video: string | null;
}

export interface DropRef {
  id: string;
  title: string;
  brand: string;
  dateLabel: string;
  timeLabel: string | null;
  priceInr: number | null;
  priceNote: string | null;
  image: string | null;
  confirmation: 'confirmed' | 'reported' | 'unconfirmed';
}

export type MagPage =
  | { t: 'cover'; headline: string; deck: string; image: string | null; imageStyle: 'product' | 'photo' | null; imageCredit: string | null; href: string; external: boolean; source: string; teasers: Array<{ title: string; kicker: string | null }>; masthead: string; issueLabel: string; dateLabel: string }
  | { t: 'editor'; title: string; paragraphs: string[]; stats: Array<{ label: string; value: string }>; images: string[]; imageStyles: Array<'product' | 'photo'> }
  | { t: 'contents'; items: Array<{ title: string; page: number }>; images: string[]; imageStyles: Array<'product' | 'photo'> }
  | { t: 'photos'; title: string; stories: StoryRef[] }
  | { t: 'videos'; title: string; stories: StoryRef[] }
  | { t: 'feature'; story: StoryRef }
  | { t: 'grid'; title: string; stories: StoryRef[] }
  | { t: 'drops'; title: string; drops: DropRef[]; part: number; parts: number }
  | { t: 'brief'; title: string; stories: StoryRef[] }
  | { t: 'notes'; lines: string[] }
  | { t: 'back'; masthead: string; line: string };

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

export interface Issue extends IssueSummary {
  pages: MagPage[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const pdfUrl = (slug: string) => `${API_URL}/magazine/${slug}/pdf`;

/** Never throws: no issues yet is a normal state. */
export async function fetchIssues(kind?: 'daily' | 'weekly', init?: RequestInit): Promise<IssueSummary[]> {
  try {
    const res = await fetch(`${API_URL}/magazine${kind ? `?kind=${kind}` : ''}`, init);
    return res.ok ? ((await res.json()) as IssueSummary[]) : [];
  } catch {
    return [];
  }
}

export async function fetchIssue(slug: string, init?: RequestInit): Promise<Issue | null> {
  try {
    const res = await fetch(`${API_URL}/magazine/${encodeURIComponent(slug)}`, init);
    return res.ok ? ((await res.json()) as Issue) : null;
  } catch {
    return null;
  }
}
