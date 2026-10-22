import { describe, expect, it } from 'vitest';
import { assembleIssue, deck, isoWeek, issueSlug, youtubeId, type DropRef, type StoryRef } from './magazine-logic';

const story = (n: number, over: Partial<StoryRef> = {}): StoryRef => ({
  id: `s${n}`, title: `Nike Dunk Low story ${n}`, deck: 'A short standfirst', source: 'Hypebeast', kicker: 'release', image: `/media/news/s${n}.jpg`, imageCredit: 'Photo: Hypebeast', imageStyle: 'photo', imageRatio: 1.5,
  href: `https://example.com/${n}`, external: true, publishedAt: '2026-10-21T04:00:00Z', india: false, shoeQuery: null, video: null, ...over,
});
const drop = (n: number): DropRef => ({ id: `d${n}`, title: `Drop ${n}`, brand: 'Nike', dateLabel: 'Thu, 22 Oct', timeLabel: null, priceInr: 9999, priceNote: null, image: null, confirmation: 'reported' });
const now = new Date('2026-10-21T02:00:00Z');

describe('assembleIssue', () => {
  const stories = Array.from({ length: 30 }, (_, i) => story(i + 1, { india: i % 7 === 0, kicker: i % 5 === 0 ? 'industry' : 'release', image: i % 4 === 3 ? null : `/media/news/s${i}.jpg` }));

  it('builds a cover, facing pairs and a back cover, always an even number of pages', () => {
    for (const d of [0, 2, 5, 8]) {
      const a = assembleIssue({ kind: 'daily', issueNo: 1, now, stories, drops: Array.from({ length: d }, (_, i) => drop(i)), sourceCount: 16 })!;
      expect(a.pages.length % 2).toBe(0);
      expect(a.pages[0]!.t).toBe('cover');
      expect(a.pages[a.pages.length - 1]!.t).toBe('back');
    }
  });

  it('uses each story once and puts a picture story on the cover', () => {
    const a = assembleIssue({ kind: 'daily', issueNo: 3, now, stories, drops: [drop(1)], sourceCount: 16 })!;
    const ids: string[] = [];
    for (const p of a.pages) {
      if (p.t === 'feature') ids.push(p.story.id);
      if (p.t === 'grid' || p.t === 'brief') ids.push(...p.stories.map((s) => s.id));
      if (p.t === 'cover') expect(p.image).toBeTruthy();
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists the sections in the contents with the right page numbers', () => {
    const a = assembleIssue({ kind: 'weekly', issueNo: 2, now, stories, drops: [1, 2, 3, 4, 5].map(drop), sourceCount: 20 })!;
    const contents = a.pages.find((p) => p.t === 'contents');
    expect(contents && contents.t === 'contents' && contents.items.length).toBeGreaterThan(3);
    if (contents && contents.t === 'contents') {
      for (const item of contents.items) expect(item.page).toBeGreaterThanOrEqual(2);
      const drops = contents.items.find((i) => i.title === 'Drops')!;
      expect(a.pages[drops.page - 1]!.t).toBe('drops');
    }
    expect(a.pages.filter((p) => p.t === 'drops').length).toBe(2);
  });

  it('prints nothing when there is nothing to print', () => {
    expect(assembleIssue({ kind: 'daily', issueNo: 1, now, stories: [story(1)], drops: [], sourceCount: 1 })).toBeNull();
  });
});

describe('slugs and decks', () => {
  it('names a daily by its Indian date and a weekly by its ISO week', () => {
    expect(issueSlug('daily', new Date('2026-10-20T20:00:00Z'))).toBe('2026-10-21'); // 01:30 IST on the 21st
    expect(isoWeek(new Date('2026-10-21T00:00:00Z'))).toEqual({ year: 2026, week: 43 });
    expect(issueSlug('weekly', new Date('2026-10-21T02:00:00Z'))).toBe('2026-w43');
  });
  it('drops a standfirst that only repeats the headline and trims long ones', () => {
    expect(deck('Same Title', 'same title')).toBe('');
    expect(deck('x'.repeat(300), 'T').length).toBeLessThanOrEqual(160);
  });
});

describe('videos and photo pages', () => {
  it('finds a YouTube id in watch, short and youtu.be links only', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=jNQXAC9IVRw')).toBe('jNQXAC9IVRw');
    expect(youtubeId('https://www.youtube.com/watch?feature=share&v=jNQXAC9IVRw&t=3')).toBe('jNQXAC9IVRw');
    expect(youtubeId('https://youtu.be/jNQXAC9IVRw')).toBe('jNQXAC9IVRw');
    expect(youtubeId('https://www.youtube.com/shorts/jNQXAC9IVRw')).toBe('jNQXAC9IVRw');
    expect(youtubeId('https://example.com/watch?v=jNQXAC9IVRw')).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });

  it('adds a Watch page for video stories and an In pictures page, and keeps the page count even', () => {
    const list = Array.from({ length: 24 }, (_, i) => story(i + 1, { video: i === 5 || i === 9 ? 'jNQXAC9IVRw' : null }));
    const a = assembleIssue({ kind: 'daily', issueNo: 1, now, stories: list, drops: [drop(1), drop(2)], sourceCount: 12 })!;
    expect(a.pages.some((p) => p.t === 'videos')).toBe(true);
    expect(a.pages.some((p) => p.t === 'photos')).toBe(true);
    expect(a.pages.length % 2).toBe(0);
    const videos = a.pages.find((p) => p.t === 'videos');
    expect(videos && videos.t === 'videos' && videos.stories.every((s) => s.video)).toBe(true);
  });
});

describe('standfirst cleaning', () => {
  it('drops a spec sheet and a leading "Summary"', () => {
    expect(deck('Name: Nike LeBron Witness 10 (backslash) Colorway: Fibreglass SKU: IQ9846-300 MSRP: $105', 'T')).toBe('');
    expect(deck('Summary adidas and Pharrell expand the lineup.', 'T')).toBe('adidas and Pharrell expand the lineup.');
  });
});
