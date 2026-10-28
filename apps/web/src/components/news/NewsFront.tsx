'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { cx } from '@chosn/ui';
import { ShoePhoto } from '@/components/ui/ShoePhoto';
import { relativeTime } from '@/lib/catalog';
import { API_URL } from '@/lib/watch';
import { CATEGORY_LABEL, excerpt, type NewsCategory, type NewsListItem } from '@/lib/news';

const SERIF: CSSProperties = { fontFamily: 'var(--font-display), Georgia, "Times New Roman", serif', letterSpacing: '-0.01em', fontWeight: 700, textTransform: 'none' };
const PAGE = 15;

type Filter = 'all' | NewsCategory;
const FILTERS: Array<{ value: Filter; label: string }> = [{ value: 'all', label: 'Top stories' }, ...(Object.entries(CATEGORY_LABEL) as Array<[NewsCategory, string]>).map(([value, label]) => ({ value, label }))];

/** Where a story opens: our own writing has a page here; a gathered headline goes to the publisher. */
function Open({ item, className, children }: { item: NewsListItem; className?: string; children: React.ReactNode }) {
  return item.external ? (
    <a href={item.sourceUrl ?? '#'} target="_blank" rel="noopener noreferrer nofollow" className={className}>
      {children}
    </a>
  ) : (
    <Link href={`/news/${item.id}`} className={className}>
      {children}
    </Link>
  );
}

/** A story's picture (kept on our server). Renders nothing when there is none or it cannot load, so a story is never left with an empty frame. */
function Pic({ item, className }: { item: NewsListItem; className: string }) {
  if (!item.imageUrl) return null;
  return (
    <div className={cx('relative overflow-hidden bg-[#E9EDF2]', className)}>
      <ShoePhoto src={item.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" fallback={null} />
    </div>
  );
}

function Credit({ item }: { item: NewsListItem }) {
  return item.imageUrl && item.imageCredit ? <p className="mt-1 font-mono text-[0.56rem] uppercase tracking-[0.12em] text-[#0A0A0A]/40">{item.imageCredit}</p> : null;
}

function Kicker({ item }: { item: NewsListItem }) {
  return (
    <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#0A0A0A]/55">
      {item.category ? <span className="text-[#0A0A0A]">{CATEGORY_LABEL[item.category]}</span> : null}
      {item.category ? ' · ' : ''}
      {item.source} · <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt)}</time>
    </p>
  );
}

/** The links a story carries: the shoe to compare, the drop it is about, and other sites that ran it. */
function Extras({ item }: { item: NewsListItem }) {
  const chip = 'relative z-10 rounded-full border border-[#0A0A0A]/15 bg-white px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[#0A0A0A] transition-colors hover:border-[#0A0A0A]';
  const also = item.alsoCoveredBy ?? [];
  if (!item.shoeQuery && !item.dropEventId && also.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {item.shoeQuery ? (
        <Link href={`/sneakers?q=${encodeURIComponent(item.shoeQuery)}`} className={chip}>
          Compare prices
        </Link>
      ) : null}
      {item.dropEventId ? (
        <Link href={`/drops/${item.dropEventId}`} className={chip}>
          On the drop calendar
        </Link>
      ) : null}
      {also.length > 0 ? <span className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[#0A0A0A]/45">Also: {also.slice(0, 3).join(', ')}</span> : null}
    </div>
  );
}

function ReadAt({ item }: { item: NewsListItem }) {
  return item.external ? (
    <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]/55">
      Read at {item.source} <ArrowUpRight className="h-3 w-3" aria-hidden />
    </span>
  ) : (
    <span className="mt-1.5 inline-block font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#0A0A0A]/55">Read the story</span>
  );
}

/**
 * The News tab as a newspaper front page: a masthead, a lead story with a column of "also today" headlines beside it, then ruled columns
 * of the rest. Stories come ranked (fresh first, then ones that name a brand, a shoe we track or a drop). Our own articles open here;
 * headlines gathered from other sites open at the publisher. Filter by kind of story or by brand.
 */
export function NewsFront({ items, sourceCount }: { items: NewsListItem[]; sourceCount: number }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [brand, setBrand] = useState('');
  const [shown, setShown] = useState(PAGE);
  const router = useRouter();
  const [fresh, setFresh] = useState(0);

  // Every minute, ask the API what the newest story is; when something newer than what this page was drawn with exists, say so.
  const newest = useMemo(() => items.reduce((m, i) => (i.publishedAt > m ? i.publishedAt : m), ''), [items]);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/news?limit=20&sort=latest`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { items: Array<{ publishedAt: string }> };
        if (alive) setFresh(body.items.filter((i) => i.publishedAt > newest).length);
      } catch {
        /* offline: try again next minute */
      }
    };
    const t = window.setInterval(() => void check(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [newest]);

  const brands = useMemo(() => {
    const n = new Map<string, number>();
    for (const i of items) for (const b of i.brands ?? []) n.set(b, (n.get(b) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [items]);

  const list = useMemo(() => items.filter((i) => (filter === 'all' || i.category === filter) && (!brand || (i.brands ?? []).includes(brand))), [items, filter, brand]);
  const [lead, ...others] = list;
  const side = others.slice(0, 4);
  const columns = others.slice(4, 4 + shown);
  const more = others.length - 4 - columns.length;

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const select =
    'min-h-[40px] cursor-pointer appearance-none rounded-full border border-[#0A0A0A]/12 bg-white px-4 pr-8 font-mono text-[0.72rem] text-[#0A0A0A] [background-image:linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)] [background-position:calc(100%-16px)_52%,calc(100%-11px)_52%] [background-size:5px_5px] [background-repeat:no-repeat] hover:border-[#0A0A0A]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice';

  return (
    <div className="text-[#0A0A0A]">
      {/* Masthead. */}
      <header className="border-y-[3px] border-double border-[#0A0A0A] py-5 text-center">
        <h2 style={SERIF} className="text-[clamp(2.4rem,7vw,5rem)] leading-none">
          The CHOSN Times
        </h2>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-[#0A0A0A]/25 pt-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[#0A0A0A]/60">
          <span>{today}</span>
          <span aria-hidden>·</span>
          <span>Sneaker news from {sourceCount} sources</span>
          <span aria-hidden>·</span>
          <span>{list.length} stories</span>
        </p>
        <Link href="/magazine" className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-[#FFD84A] px-5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#0A0A0A] transition-colors hover:bg-[#FFC400]">
          Read it as a magazine: turn the pages, download the PDF <span aria-hidden>→</span>
        </Link>
      </header>

      {fresh > 0 && (
        <button
          type="button"
          onClick={() => {
            setFresh(0);
            router.refresh();
          }}
          className="sticky top-20 z-20 mx-auto mt-4 flex items-center gap-2 rounded-full bg-[#C8102E] px-5 py-2.5 font-mono text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white shadow-lg transition-colors hover:bg-[#A60C24]"
        >
          <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-[#FFD84A]" />
          {fresh} new {fresh === 1 ? 'story' : 'stories'} · Tap to refresh
        </button>
      )}

      {/* Filters. */}
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Kind of story" className="inline-flex flex-wrap rounded-full border border-[#0A0A0A]/12 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => {
                setFilter(f.value);
                setShown(PAGE);
              }}
              className={cx(
                'min-h-[34px] rounded-full px-3.5 font-mono text-[0.72rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice',
                filter === f.value ? 'bg-[#0A0A0A] text-white' : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {brands.length > 0 && (
          <select aria-label="Filter by brand" value={brand} onChange={(e) => { setBrand(e.target.value); setShown(PAGE); }} className={select}>
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}
      </div>

      {!lead ? (
        <p className="border border-[#0A0A0A]/12 bg-white px-5 py-8 text-center text-[0.95rem] text-[#0A0A0A]/60">No stories match. Try another kind or brand.</p>
      ) : (
        <>
          {/* Front page: lead story and the "also today" column. */}
          <section className="grid gap-8 border-b border-[#0A0A0A]/25 pb-8 lg:grid-cols-[1.7fr_1fr] lg:gap-0">
            <article className="relative lg:border-r lg:border-[#0A0A0A]/25 lg:pr-8">
              <Pic item={lead} className="mb-4 aspect-[16/9] w-full" />
              <Credit item={lead} />
              <div className={lead.imageUrl ? 'mt-3' : ''}>
              <Kicker item={lead} />
              <h3 style={SERIF} className="mt-2 text-[clamp(1.9rem,4vw,3.1rem)] leading-[1.04]">
                <Open item={lead} className="after:absolute after:inset-0 hover:underline decoration-2 underline-offset-4">
                  {lead.title}
                </Open>
              </h3>
              {lead.body && lead.body !== lead.title ? <p className="mt-4 max-w-[60ch] text-[1.05rem] leading-relaxed text-[#0A0A0A]/75">{excerpt(lead.body, 260)}</p> : null}
              <ReadAt item={lead} />
              <Extras item={lead} />
              </div>
            </article>
            <aside aria-label="Also today" className="lg:pl-8">
              <p className="mb-3 border-b-2 border-[#0A0A0A] pb-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">Also today</p>
              <ol className="flex flex-col divide-y divide-[#0A0A0A]/15">
                {side.map((s) => (
                  <li key={s.id} className="relative flex gap-3 py-3 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <Kicker item={s} />
                      <h4 style={SERIF} className="mt-1 text-[1.2rem] leading-[1.15]">
                        <Open item={s} className="after:absolute after:inset-0 hover:underline underline-offset-4">
                          {s.title}
                        </Open>
                      </h4>
                      <Extras item={s} />
                    </div>
                    <Pic item={s} className="h-20 w-24 shrink-0 self-start rounded-sm" />
                  </li>
                ))}
              </ol>
            </aside>
          </section>

          {/* The rest, in ruled columns. */}
          {columns.length > 0 && (
            <section aria-label="More stories" className="mt-8 grid gap-x-0 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
              {columns.map((s, i) => (
                <article key={s.id} className={cx('relative border-b border-[#0A0A0A]/15 py-5 sm:px-5', i % 3 !== 0 && 'lg:border-l lg:border-[#0A0A0A]/15', i % 2 !== 0 && 'sm:max-lg:border-l sm:max-lg:border-[#0A0A0A]/15', 'lg:[&:nth-child(3n+1)]:pl-0')}>
                  <Pic item={s} className="mb-3 aspect-[16/10] w-full" />
                  <Kicker item={s} />
                  <h4 style={SERIF} className="mt-1.5 text-[1.3rem] leading-[1.12]">
                    <Open item={s} className="after:absolute after:inset-0 hover:underline underline-offset-4">
                      {s.title}
                    </Open>
                  </h4>
                  {s.body && s.body !== s.title ? <p className="mt-2 line-clamp-3 text-[0.9rem] leading-relaxed text-[#0A0A0A]/65">{excerpt(s.body, 150)}</p> : null}
                  <ReadAt item={s} />
                  <Extras item={s} />
                </article>
              ))}
            </section>
          )}

          {more > 0 && (
            <div className="mt-8 flex justify-center">
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className="rounded-full border border-[#0A0A0A] bg-white px-7 py-3 font-display text-lg uppercase tracking-[0.06em] text-[#0A0A0A] hover:bg-[#FFFFFF]">
                More stories ({more} left)
              </button>
            </div>
          )}
        </>
      )}
      <p className="mt-8 border-t border-[#0A0A0A]/25 pt-3 text-center font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[#0A0A0A]/45">
        Headlines are gathered from publishers&apos; public feeds and link to the original. Our own stories are written by CHOSN from named sources.
      </p>
    </div>
  );
}
