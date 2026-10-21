/**
 * The CHOSN Times: how an issue is put together. Pure functions, no database (magazine-logic.spec.ts), so the layout rules are tested.
 *
 * An issue is a list of pages (JSON). A cover first, then two-page spreads, then a back cover, so the total is always even:
 *   cover | editor's note + contents | lead feature + top stories | drops (two pages) | more stories + in brief | India + industry | notes | back cover
 * Sections with nothing to show are left out and the issue is padded to an even number of pages with a notes page.
 */

export type IssueKind = 'daily' | 'weekly';

export interface StoryRef {
  id: string;
  title: string;
  /** A short standfirst: the story's own first lines or the feed excerpt (at most 180 characters). */
  deck: string;
  source: string;
  /** What kind of story: release, collab, culture or industry. */
  kicker: string | null;
  image: string | null;
  imageCredit: string | null;
  /** "product": a shoe on a plain light background (shown as a cut-out on a coloured panel); "photo": fills its frame. */
  imageStyle: 'product' | 'photo' | null;
  /** Width divided by height. */
  imageRatio: number | null;
  /** Where a click goes: our own article page, or the publisher for a gathered headline. */
  href: string;
  external: boolean;
  publishedAt: string;
  india: boolean;
  shoeQuery: string | null;
  /** A YouTube video id when the story is a video (its link is a YouTube watch page). */
  video: string | null;
}

export interface DropRef {
  id: string;
  title: string;
  brand: string;
  /** "Thu, 22 Oct" and, when a time is known, the Indian time. */
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

export interface AssembleInput {
  kind: IssueKind;
  issueNo: number;
  now: Date;
  /** Ranked best first. */
  stories: StoryRef[];
  /** Soonest first. */
  drops: DropRef[];
  sourceCount: number;
}

export interface Assembled {
  title: string;
  pages: MagPage[];
  periodStart: string;
  periodEnd: string;
}

export const MASTHEAD = 'The CHOSN Times';
const DECK = 160;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export function deck(text: string, title: string): string {
  const t = text.replace(/^summary\s+/i, '').replace(/\s+/g, ' ').trim();
  if (!t || t.toLowerCase() === title.toLowerCase()) return '';
  // Some feeds put a spec sheet where the excerpt should be ("Name: ... Colorway: ... SKU: ... MSRP: ..."); that is not a standfirst.
  if (/\b(sku|msrp|colou?rway|release date|style code)\s*:/i.test(t) || t.split(String.fromCharCode(92)).length > 2) return '';
  return t.length > DECK ? `${t.slice(0, DECK - 1).trimEnd()}…` : t;
}

/** "Wednesday, 21 October 2026" in Indian time. */
export function dateLabel(now: Date): string {
  return now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/** ISO week number and year of a date, e.g. 2026-W43. */
export function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return { year, week };
}

/** The address of an issue: 2026-10-21 for a daily, 2026-w43 for a weekly. */
export function issueSlug(kind: IssueKind, now: Date): string {
  if (kind === 'daily') return isoDay(new Date(now.getTime() + 5.5 * 3_600_000));
  const { year, week } = isoWeek(new Date(now.getTime() + 5.5 * 3_600_000));
  return `${year}-w${String(week).padStart(2, '0')}`;
}

export function issueLabel(kind: IssueKind, issueNo: number): string {
  return `${kind === 'daily' ? 'Daily' : 'Weekly'} edition · No. ${issueNo}`;
}

function take<T>(list: T[], n: number, used: Set<unknown>, pick: (x: T) => boolean = () => true, key: (x: T) => unknown = (x) => x): T[] {
  const out: T[] = [];
  for (const x of list) {
    if (out.length >= n) break;
    if (used.has(key(x)) || !pick(x)) continue;
    used.add(key(x));
    out.push(x);
  }
  return out;
}

const hasPic = (s: StoryRef) => Boolean(s.image);
/** The first two pictures among some stories, with how to show each. */
const pics = (list: Array<StoryRef | undefined>): { images: string[]; imageStyles: Array<'product' | 'photo'> } => {
  const have = list.filter((s): s is StoryRef => Boolean(s?.image)).slice(0, 2);
  return { images: have.map((s) => s.image as string), imageStyles: have.map((s) => s.imageStyle ?? 'photo') };
};

/** The YouTube video id in a watch or short link, or null. */
export function youtubeId(url: string | null): string | null {
  const m = (url ?? '').match(/(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i);
  return m ? m[1]! : null;
}

/** Puts an issue together from ranked stories and upcoming drops. Returns null when there is nothing worth printing. */
export function assembleIssue(input: AssembleInput): Assembled | null {
  const { kind, issueNo, now, stories, drops } = input;
  if (stories.length < 3 && drops.length === 0) return null;

  const used = new Set<string>();
  const key = (s: StoryRef) => s.id;
  const coverStory = take(stories, 1, used, (s) => hasPic(s) && s.imageStyle === 'photo', key)[0] ?? take(stories, 1, used, hasPic, key)[0] ?? take(stories, 1, used, () => true, key)[0];
  if (!coverStory) return null;
  const feature = take(stories, 1, used, hasPic, key)[0];
  const top = take(stories, 3, used, hasPic, key);
  const videos = take(stories, 4, used, (s) => Boolean(s.video), key);
  const photos = take(stories, 3, used, hasPic, key);
  const more = take(stories, 3, used, hasPic, key);
  const india = take(stories, 3, used, (s) => s.india, key);
  const industry = take(stories, 3, used, (s) => s.kicker === 'industry', key);
  const brief = take(stories, 10, used, () => true, key);

  const shown = drops.slice(0, 8);
  const dropPages: MagPage[] = [];
  for (let i = 0; i < shown.length; i += 4) {
    dropPages.push({ t: 'drops', title: kind === 'daily' ? 'Dropping soon' : 'This fortnight’s drops', drops: shown.slice(i, i + 4), part: i / 4 + 1, parts: Math.ceil(shown.length / 4) });
  }
  // Drops go on a facing pair; with an odd number of pages a notes page follows.
  const teasers = [feature, ...top].filter((s): s is StoryRef => Boolean(s)).slice(0, 3).map((s) => ({ title: s.title, kicker: s.kicker }));

  const body: MagPage[] = [];
  const sections: Array<{ title: string; at: number }> = [];
  const add = (page: MagPage, title: string | null) => {
    if (title) sections.push({ title, at: body.length });
    body.push(page);
  };

  // Spread 1: editor's note and contents (their page numbers are filled in below).
  const editor: MagPage = {
    t: 'editor',
    title: kind === 'daily' ? 'Good morning' : 'This week in sneakers',
    ...pics([feature, top[0], coverStory]),
    paragraphs: [
      kind === 'daily'
        ? `Here is what happened in sneakers today: ${stories.length} stories from ${input.sourceCount} sources${drops.length ? ` and ${drops.length} drop${drops.length === 1 ? '' : 's'} on the calendar` : ''}.`
        : `Here is the week in sneakers: ${stories.length} stories from ${input.sourceCount} sources${drops.length ? ` and ${drops.length} drop${drops.length === 1 ? '' : 's'} coming up` : ''}.`,
      `Our lead story is ${coverStory.title}.${shown[0] ? ` The next drop on the calendar is ${shown[0].title} on ${shown[0].dateLabel}.` : ''}`,
      'Every headline opens the full story. Dates and prices come with their source and how firm they are, and prices are in rupees.',
    ],
    stats: [
      { label: 'Stories', value: String(stories.length) },
      { label: 'Drops ahead', value: String(drops.length) },
      { label: 'Sources', value: String(input.sourceCount) },
    ],
  };
  body.push(editor);
  body.push({ t: 'contents', items: [], images: [], imageStyles: [] });

  if (feature) add({ t: 'feature', story: feature }, 'Lead story');
  if (top.length) add({ t: 'grid', title: 'Top stories', stories: top }, 'Top stories');
  dropPages.forEach((p, i) => add(p, i === 0 ? 'Drops' : null));
  if (photos.length >= 2) add({ t: 'photos', title: 'In pictures', stories: photos }, 'In pictures');
  if (more.length) add({ t: 'grid', title: 'More from the world of sneakers', stories: more }, 'More stories');
  if (videos.length) add({ t: 'videos', title: 'Watch', stories: videos }, 'Watch');
  if (brief.length) add({ t: 'brief', title: 'In brief', stories: brief }, 'In brief');
  if (india.length) add({ t: 'grid', title: 'India', stories: india }, 'India');
  if (industry.length) add({ t: 'grid', title: 'Industry', stories: industry }, 'Industry');

  // Cover and back cover are single pages; the pages between them come in facing pairs.
  if ((body.length + 2) % 2 !== 0) {
    body.push({ t: 'notes', lines: ['How this issue is made: our own stories are written by CHOSN from named sources; other headlines come from publishers’ public feeds and link to the original.', 'Photos belong to their publishers and are credited. Prices are in rupees; a dollar price is converted at the day’s rate and marked.', 'Drop dates say how firm they are: Confirmed, Reported or Unconfirmed.'] });
  }

  const contents = body.find((p) => p.t === 'contents');
  if (contents && contents.t === 'contents') {
    contents.items = [{ title: 'Editor’s note', page: 2 }, ...sections.map((s) => ({ title: s.title, page: s.at + 2 }))];
    Object.assign(contents, pics([feature, photos[0], top[1], more[0]]));
  }

  const cover: MagPage = {
    t: 'cover',
    headline: coverStory.title,
    deck: coverStory.deck,
    image: coverStory.image,
    imageStyle: coverStory.imageStyle,
    imageCredit: coverStory.imageCredit,
    href: coverStory.href,
    external: coverStory.external,
    source: coverStory.source,
    teasers,
    masthead: MASTHEAD,
    issueLabel: issueLabel(kind, issueNo),
    dateLabel: dateLabel(now),
  };
  const back: MagPage = { t: 'back', masthead: MASTHEAD, line: kind === 'daily' ? 'See you tomorrow.' : 'See you next week.' };

  const periodStart = kind === 'daily' ? issueSlug('daily', now) : isoDay(addDays(new Date(now.getTime() + 5.5 * 3_600_000), -(((new Date(now.getTime() + 5.5 * 3_600_000).getUTCDay() + 6) % 7))));
  const periodEnd = kind === 'daily' ? periodStart : isoDay(addDays(new Date(`${periodStart}T00:00:00Z`), 6));
  return { title: `${MASTHEAD}: ${issueLabel(kind, issueNo)}`, pages: [cover, ...body, back], periodStart, periodEnd };
}
