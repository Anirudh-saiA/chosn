import type { CSSProperties, ReactNode } from 'react';
import { pdfUrl, type DropRef, type MagPage, type StoryRef } from '@/lib/magazine';

/**
 * The pages of The CHOSN Times, set like a fashion and business glossy: a running head on every page, generous margins, thin rules, a bold
 * serif beside its own regular italic, small capital kickers, and photographs treated by what they are. A white-background product shot
 * becomes a cut-out on a tinted panel (the white drops away); a studio or street photograph fills its frame; captions sit under the photo.
 * Designed on a 600 x 800 sheet; every size is in container-query units (cqw: 1cqw is 6px of the sheet), so a page looks the same at any
 * size on screen and in the PDF. Plain <a> links are used on purpose: the page-turning reader clones these pages.
 */
const SERIF: CSSProperties = { fontFamily: 'var(--font-mag-serif), Georgia, "Times New Roman", serif', textTransform: 'none' };
const SANS: CSSProperties = { fontFamily: 'var(--font-sans), system-ui, sans-serif', textTransform: 'none' };
const IMPACT: CSSProperties = { fontFamily: 'var(--font-impact), Impact, sans-serif', textTransform: 'uppercase', letterSpacing: '0.01em', fontWeight: 400 };
const MONO: CSSProperties = { fontFamily: 'var(--font-mono), ui-monospace, monospace' };
const INK = '#141414';
const PAPER = '#FBF8F3';
const RED = '#C8102E';
const DEEP = '#8F0A20';
const YELLOW = '#FFD84A';
const TINTS = ['#EFE3D3', '#E3E9EF', '#F3D9DC', '#E6EDDD'];
const M = '9cqw'; // side margin

const KICKER: Record<string, string> = { release: 'Release', collab: 'Collab', culture: 'Culture', industry: 'Industry' };
const kickerLabel = (k: string | null) => (k ? (KICKER[k] ?? k) : 'Sneakers');
const clamp = (n: number): CSSProperties => ({ display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', overflow: 'hidden' });
const link = (s: { href: string; external: boolean }) => (s.external ? ({ href: s.href, target: '_blank', rel: 'noopener noreferrer nofollow' } as const) : ({ href: s.href } as const));

function ago(iso: string): string {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
  return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function Sheet({ bg, color = INK, children, hard = false }: { bg: string; color?: string; children: ReactNode; hard?: boolean }) {
  return (
    <div className="mag-page" data-density={hard ? 'hard' : 'soft'} style={{ background: bg, color, containerType: 'size', width: '100%', height: '100%', position: 'relative', overflow: 'hidden', ...SANS }}>
      {children}
    </div>
  );
}

/** The running head at the top of an inside page: the title in bold, the section in regular, a hairline under both. */
function RunHead({ section, dark = false }: { section: string; dark?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: M, right: M, top: '5.4cqw', display: 'flex', justifyContent: 'space-between', borderBottom: `0.25cqw solid ${dark ? '#ffffff55' : '#14141455'}`, paddingBottom: '1.6cqw', fontSize: '1.75cqw', letterSpacing: '0.2em', textTransform: 'uppercase', color: dark ? '#fff' : INK }}>
      <span style={{ fontWeight: 800 }}>The CHOSN Times</span>
      <span style={{ fontWeight: 400, opacity: 0.75 }}>{section}</span>
    </div>
  );
}

function Folio({ n, dark = false }: { n: number; dark?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: M, right: M, bottom: '4cqw', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: dark ? '#fff' : INK }}>
      <span style={{ ...SERIF, fontWeight: 900, fontSize: '3.4cqw', color: dark ? '#fff' : RED }}>{n}</span>
      <span style={{ fontSize: '1.6cqw', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.55 }}>chosn.in</span>
    </div>
  );
}

function Kicker({ children, color = RED }: { children: ReactNode; color?: string }) {
  return <p style={{ margin: 0, fontSize: '1.8cqw', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color }}>{children}</p>;
}

/**
 * A headline set in two weights: the opening words in bold, the rest in the same serif, regular and italic. The break falls at the first
 * quotation mark or dash when there is one, else about halfway.
 */
function Head({ text, size, color = INK, lines }: { text: string; size: string; color?: string; lines?: number }) {
  const words = text.split(' ');
  let cut = words.findIndex((w, i) => i >= 2 && i <= words.length - 2 && /^[“"‘–—-]/.test(w));
  if (cut < 0) cut = words.length <= 3 ? words.length : Math.min(words.length - 1, Math.max(2, Math.ceil(words.length * 0.45)));
  return (
    <span style={{ ...SERIF, fontSize: size, lineHeight: 1.08, color, ...(lines ? clamp(lines) : { display: 'block' }) }}>
      <b style={{ fontWeight: 900 }}>{words.slice(0, cut).join(' ')}</b>
      {cut < words.length ? <span style={{ fontWeight: 400, fontStyle: 'italic' }}> {words.slice(cut).join(' ')}</span> : null}
    </span>
  );
}

/** Artwork: a product shot is a cut-out (multiply drops the white) on a tinted panel; a photograph fills its frame. */
function Art({ src, kind, tint = TINTS[0]!, box, alt = '', pos = 'center' }: { src: string | null; kind: StoryRef['imageStyle']; tint?: string; box?: CSSProperties; alt?: string; pos?: string }) {
  const product = kind === 'product';
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: product || !src ? tint : '#E9E3DA', ...box }}>
      {src ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          style={product ? { position: 'absolute', inset: '7%', width: '86%', height: '86%', objectFit: 'contain', mixBlendMode: 'multiply' } : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `repeating-linear-gradient(135deg, ${RED} 0 2cqw, ${DEEP} 2cqw 4cqw)` }} />
      )}
    </div>
  );
}

/** A decorative barcode, as on a printed cover. */
function Barcode({ text }: { text: string }) {
  const bars = 'linear-gradient(90deg,#111 0 3%,#fff 3% 5%,#111 5% 6%,#fff 6% 10%,#111 10% 14%,#fff 14% 15%,#111 15% 16%,#fff 16% 20%,#111 20% 25%,#fff 25% 27%,#111 27% 29%,#fff 29% 33%,#111 33% 34%,#fff 34% 38%,#111 38% 42%,#fff 42% 44%,#111 44% 45%,#fff 45% 50%,#111 50% 55%,#fff 55% 57%,#111 57% 58%,#fff 58% 63%,#111 63% 67%,#fff 67% 69%,#111 69% 70%,#fff 70% 75%,#111 75% 80%,#fff 80% 82%,#111 82% 84%,#fff 84% 88%,#111 88% 92%,#fff 92% 94%,#111 94% 97%,#fff 97%)';
  return (
    <div style={{ background: '#fff', padding: '1.4cqw 1.8cqw 1cqw', width: '19cqw' }}>
      <div style={{ height: '8cqw', backgroundImage: bars }} />
      <div style={{ ...MONO, fontSize: '1.4cqw', letterSpacing: '0.14em', textAlign: 'center', marginTop: '0.6cqw', color: INK }}>{text}</div>
    </div>
  );
}

function Cover({ p }: { p: Extract<MagPage, { t: 'cover' }> }) {
  const lines = p.teasers.slice(0, 3);
  const product = p.imageStyle === 'product';
  return (
    <Sheet bg={RED} color="#fff" hard>
      <div style={{ position: 'absolute', left: 0, right: 0, top: product ? '26cqw' : 0, bottom: product ? '22cqw' : 0 }}>
        {product ? (
          <Art src={p.image} kind="product" tint={RED} box={{ position: 'absolute', inset: 0 }} alt="" />
        ) : (
          <>
            <Art src={p.image} kind="photo" box={{ position: 'absolute', inset: 0 }} alt="" />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(120,8,26,0.82) 0%, rgba(120,8,26,0.05) 30%, rgba(120,8,26,0.1) 55%, rgba(120,8,26,0.94) 100%)' }} />
          </>
        )}
      </div>
      <div style={{ position: 'absolute', left: '6cqw', right: '6cqw', top: '5cqw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.8cqw', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
          <span>Sneakers · Drops · News</span>
          <span style={{ fontWeight: 400 }}>{p.issueLabel}</span>
        </div>
        <p style={{ ...SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: '4.4cqw', margin: '2.6cqw 0 0', lineHeight: 1 }}>The</p>
        <h1 style={{ ...SERIF, fontWeight: 900, fontSize: '11.4cqw', lineHeight: 0.9, margin: '0.4cqw 0 0', letterSpacing: '0.02em', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>CHOSN Times</h1>
        <p style={{ margin: '1.6cqw 0 0', fontSize: '1.8cqw', letterSpacing: '0.26em', textTransform: 'uppercase', opacity: 0.85 }}>{p.dateLabel}</p>
      </div>
      {lines.length > 0 && (
        <div style={{ position: 'absolute', left: '7cqw', top: '36cqw', width: '30cqw' }}>
          {lines.map((t, i) => (
            <div key={t.title} style={{ marginBottom: '3.2cqw', textShadow: '0 0 2.6cqw rgba(120,8,26,0.95)' }}>
              <Kicker color={YELLOW}>{kickerLabel(t.kicker)}</Kicker>
              <p style={{ ...SERIF, fontStyle: i === 0 ? 'italic' : 'normal', fontWeight: i === 0 ? 400 : 700, fontSize: '3cqw', lineHeight: 1.14, margin: '0.8cqw 0 0', ...clamp(4) }}>{t.title}</p>
            </div>
          ))}
        </div>
      )}
      <div style={{ position: 'absolute', left: '6cqw', right: '27cqw', bottom: '6cqw' }}>
        <span style={{ display: 'inline-block', background: YELLOW, color: INK, fontSize: '1.8cqw', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '0.9cqw 2.2cqw' }}>Lead story</span>
        <h2 style={{ margin: '2cqw 0 0' }}>
          <a {...link(p)} style={{ textDecoration: 'none' }}>
            <Head text={p.headline} size="6.2cqw" color="#fff" lines={4} />
          </a>
        </h2>
      </div>
      <div style={{ position: 'absolute', right: '6cqw', bottom: '6cqw' }}>
        <Barcode text={p.issueLabel.replace(/[^0-9A-Za-z]/g, '').slice(0, 12).toUpperCase()} />
      </div>
      {p.imageCredit ? <span style={{ position: 'absolute', right: '1.6cqw', top: '34cqw', fontSize: '1.3cqw', letterSpacing: '0.12em', textTransform: 'uppercase', transform: 'rotate(90deg)', transformOrigin: 'right top', opacity: 0.8 }}>{p.imageCredit}</span> : null}
    </Sheet>
  );
}

function Editor({ p, n }: { p: Extract<MagPage, { t: 'editor' }>; n: number }) {
  const [first, ...rest] = p.paragraphs;
  const body = rest.join(' ');
  return (
    <Sheet bg={PAPER}>
      <RunHead section="Editor’s letter" />
      <div style={{ position: 'absolute', left: M, right: M, top: '15cqw' }}>
        <Kicker>Editor’s letter</Kicker>
        <h2 style={{ ...SERIF, fontWeight: 900, fontStyle: 'italic', fontSize: '10cqw', lineHeight: 0.95, margin: '2cqw 0 0', color: INK }}>{p.title}.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '5cqw', marginTop: '4cqw', borderTop: `0.35cqw solid ${INK}`, paddingTop: '3cqw' }}>
          <p style={{ ...SERIF, fontWeight: 700, fontSize: '3.05cqw', lineHeight: 1.34, margin: 0 }}>{first}</p>
          <p style={{ fontSize: '2.15cqw', lineHeight: 1.65, margin: 0, color: '#141414d9' }}>
            <span style={{ ...SERIF, float: 'left', fontWeight: 900, fontSize: '9.5cqw', lineHeight: 0.8, margin: '0.7cqw 1.2cqw 0 0', color: RED }}>{body.charAt(0)}</span>
            {body.slice(1)}
          </p>
        </div>
      </div>
      <div style={{ position: 'absolute', left: M, right: M, top: '92cqw', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: `0.35cqw solid ${INK}`, borderBottom: `0.35cqw solid ${INK}` }}>
        {p.stats.map((s, i) => (
          <div key={s.label} style={{ padding: '2.6cqw 0 2.6cqw 3cqw', borderLeft: i ? '0.25cqw solid #14141433' : 'none' }}>
            <div style={{ ...SERIF, fontWeight: 900, fontSize: '8.4cqw', lineHeight: 1 }}>{s.value}</div>
            <div style={{ marginTop: '0.8cqw', fontSize: '1.6cqw', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: RED }}>{s.label}</div>
          </div>
        ))}
      </div>
      <Folio n={n} />
    </Sheet>
  );
}

function Contents({ p, n }: { p: Extract<MagPage, { t: 'contents' }>; n: number }) {
  const imgs = (p.images ?? []).slice(0, 2);
  return (
    <Sheet bg={RED} color="#fff">
      <RunHead section="Contents" dark />
      <div style={{ position: 'absolute', left: M, right: M, top: '15cqw' }}>
        <h2 style={{ ...SERIF, fontWeight: 900, fontSize: '11.5cqw', lineHeight: 0.92, margin: 0 }}>
          Table of
          <br />
          <span style={{ fontWeight: 400, fontStyle: 'italic' }}>contents</span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 32%', gap: '5cqw', marginTop: '6cqw' }}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {p.items.map((it) => (
              <li key={it.title} style={{ display: 'flex', alignItems: 'baseline', gap: '2.6cqw', borderBottom: '0.25cqw solid #ffffff55', padding: '1.2cqw 0' }}>
                <span style={{ ...SERIF, fontWeight: 900, fontSize: '4.4cqw', minWidth: '8cqw', color: YELLOW }}>{String(it.page).padStart(2, '0')}</span>
                <span style={{ ...SERIF, fontSize: '3.2cqw', fontWeight: 700 }}>{it.title}</span>
              </li>
            ))}
          </ol>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3cqw' }}>
            {imgs.map((src, i) => (
              <Art key={i} src={src} kind={p.imageStyles?.[i] ?? 'photo'} tint={TINTS[i + 1]} box={{ width: '100%', aspectRatio: '3 / 4' }} />
            ))}
          </div>
        </div>
      </div>
      <Folio n={n} dark />
    </Sheet>
  );
}

function Byline({ s }: { s: StoryRef }) {
  return (
    <p style={{ margin: 0, fontSize: '1.8cqw', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
      <b style={{ fontWeight: 800 }}>{s.source}</b>
      <span style={{ fontWeight: 400, opacity: 0.6 }}> · {ago(s.publishedAt)}</span>
    </p>
  );
}

function Feature({ p, n }: { p: Extract<MagPage, { t: 'feature' }>; n: number }) {
  const s = p.story;
  return (
    <Sheet bg={PAPER}>
      <RunHead section="Lead story" />
      <div style={{ position: 'absolute', left: M, right: M, top: '15cqw', height: '50cqw' }}>
        <Art src={s.image} kind={s.imageStyle} tint={TINTS[0]} box={{ position: 'absolute', inset: 0 }} alt={s.title} />
        <span style={{ position: 'absolute', left: 0, bottom: 0, background: RED, color: '#fff', fontSize: '1.7cqw', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '1.1cqw 2.6cqw' }}>{kickerLabel(s.kicker)}</span>
      </div>
      {s.imageCredit ? <p style={{ position: 'absolute', left: M, top: '66.2cqw', margin: 0, fontSize: '1.4cqw', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.5 }}>{s.imageCredit}</p> : null}
      <div style={{ position: 'absolute', left: M, right: M, top: '72cqw' }}>
        <h2 style={{ margin: 0 }}>
          <a {...link(s)} style={{ textDecoration: 'none' }}>
            <Head text={s.title} size="7.4cqw" lines={4} />
          </a>
        </h2>
        {s.deck ? <p style={{ ...SERIF, fontStyle: 'italic', fontSize: '3.2cqw', lineHeight: 1.42, margin: '3cqw 0 0', color: '#141414b3', ...clamp(3) }}>{s.deck}</p> : null}
        <div style={{ marginTop: '3.2cqw', paddingTop: '2.4cqw', borderTop: `0.3cqw solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3cqw' }}>
          <Byline s={s} />
          <a {...link(s)} style={{ background: INK, color: '#fff', fontSize: '1.8cqw', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '1.5cqw 3cqw', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {s.external ? 'Read at publisher ↗' : 'Read the story →'}
          </a>
        </div>
        {s.shoeQuery ? (
          <a href={`/sneakers?q=${encodeURIComponent(s.shoeQuery)}`} style={{ display: 'inline-block', marginTop: '2.4cqw', fontSize: '1.8cqw', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: RED, textDecoration: 'none', borderBottom: `0.3cqw solid ${RED}` }}>
            Compare prices in India →
          </a>
        ) : null}
      </div>
      <Folio n={n} />
    </Sheet>
  );
}

function Grid({ p, n }: { p: Extract<MagPage, { t: 'grid' }>; n: number }) {
  const [first, ...rest] = p.stories;
  return (
    <Sheet bg={PAPER}>
      <RunHead section={p.title} />
      <div style={{ position: 'absolute', left: M, right: M, top: '14cqw' }}>
        <h2 style={{ ...SERIF, fontWeight: 900, fontSize: p.title.length > 18 ? '6.8cqw' : '9.6cqw', lineHeight: 0.98, margin: 0 }}>{p.title}</h2>
        {first ? (
          <article style={{ marginTop: '4.4cqw' }}>
            <a {...link(first)} aria-label={first.title} style={{ display: 'block', position: 'relative' }}>
              <Art src={first.image} kind={first.imageStyle} tint={TINTS[1]} box={{ width: '100%', height: '28cqw' }} />
              <span style={{ position: 'absolute', left: 0, bottom: 0, background: RED, color: '#fff', fontSize: '1.5cqw', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', padding: '0.9cqw 2cqw' }}>{kickerLabel(first.kicker)}</span>
            </a>
            <div style={{ marginTop: '2.4cqw' }}>
              <Byline s={first} />
              <h3 style={{ margin: '1cqw 0 0' }}>
                <a {...link(first)} style={{ textDecoration: 'none' }}>
                  <Head text={first.title} size="4.8cqw" lines={2} />
                </a>
              </h3>
              {first.deck ? <p style={{ ...SERIF, fontStyle: 'italic', fontSize: '2.6cqw', lineHeight: 1.4, margin: '1.4cqw 0 0', color: '#141414b3', ...clamp(2) }}>{first.deck}</p> : null}
            </div>
          </article>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(2, rest.length))}, 1fr)`, gap: '5cqw', marginTop: '4cqw', paddingTop: '3cqw', borderTop: `0.35cqw solid ${INK}` }}>
          {rest.slice(0, 2).map((s, i) => (
            <article key={s.id}>
              <a {...link(s)} aria-label={s.title} style={{ display: 'block' }}>
                <Art src={s.image} kind={s.imageStyle} tint={TINTS[(i + 2) % 4]} box={{ width: '100%', height: '18cqw' }} />
              </a>
              <div style={{ marginTop: '1.8cqw' }}>
                <Kicker>{kickerLabel(s.kicker)}</Kicker>
                <h3 style={{ margin: '0.8cqw 0 0' }}>
                  <a {...link(s)} style={{ textDecoration: 'none' }}>
                    <Head text={s.title} size="3.1cqw" lines={3} />
                  </a>
                </h3>
                <p style={{ margin: '1.2cqw 0 0', fontSize: '1.6cqw', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.55 }}>{s.source}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <Folio n={n} />
    </Sheet>
  );
}

function Photos({ p, n }: { p: Extract<MagPage, { t: 'photos' }>; n: number }) {
  const [a, b, c] = p.stories;
  const small = [b, c ?? b].filter((x): x is StoryRef => Boolean(x));
  return (
    <Sheet bg={PAPER}>
      <RunHead section="In pictures" />
      <div style={{ position: 'absolute', left: M, right: M, top: '14cqw' }}>
        <h2 style={{ ...SERIF, fontWeight: 900, fontStyle: 'italic', fontSize: '10cqw', lineHeight: 0.95, margin: 0, color: RED }}>{p.title}</h2>
        {a ? (
          <figure style={{ margin: '4cqw 0 0' }}>
            <a {...link(a)} aria-label={a.title} style={{ display: 'block' }}>
              <Art src={a.image} kind={a.imageStyle} tint={TINTS[0]} box={{ width: '100%', height: '46cqw' }} />
            </a>
            <figcaption style={{ marginTop: '1.8cqw', display: 'flex', gap: '3cqw', alignItems: 'baseline' }}>
              <Byline s={a} />
            </figcaption>
            <a {...link(a)} style={{ textDecoration: 'none' }}>
              <Head text={a.title} size="4.4cqw" lines={2} />
            </a>
          </figure>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5cqw', marginTop: '5cqw' }}>
          {small.map((s, i) => (
            <figure key={`${s.id}-${i}`} style={{ margin: 0 }}>
              <a {...link(s)} aria-label={s.title} style={{ display: 'block' }}>
                <Art src={s.image} kind={s.imageStyle} tint={TINTS[i + 1]} box={{ width: '100%', height: '22cqw' }} />
              </a>
              <figcaption style={{ marginTop: '1.4cqw' }}>
                <a {...link(s)} style={{ textDecoration: 'none' }}>
                  <Head text={s.title} size="3cqw" lines={3} />
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <Folio n={n} />
    </Sheet>
  );
}

const CONF: Record<DropRef['confirmation'], string> = { confirmed: 'Confirmed', reported: 'Reported', unconfirmed: 'Unconfirmed' };

function Drops({ p, n }: { p: Extract<MagPage, { t: 'drops' }>; n: number }) {
  return (
    <Sheet bg={PAPER}>
      <RunHead section="The drop calendar" />
      <div style={{ position: 'absolute', left: M, right: M, top: '14cqw' }}>
        <Kicker>The drop calendar{p.parts > 1 ? ` · ${p.part} of ${p.parts}` : ''}</Kicker>
        <h2 style={{ ...SERIF, fontWeight: 900, fontStyle: 'italic', fontSize: '10.4cqw', lineHeight: 0.95, margin: '1.6cqw 0 0' }}>{p.part > 1 ? 'And more' : p.title}</h2>
        <div style={{ marginTop: '4cqw', borderTop: `0.35cqw solid ${INK}` }}>
          {p.drops.map((d, i) => {
            const [wd, day, mon] = d.dateLabel.replace(',', '').split(' ');
            return (
              <a key={d.id} href={`/drops/${d.id}`} style={{ display: 'grid', gridTemplateColumns: '16cqw 25cqw 1fr', gap: '3.4cqw', alignItems: 'center', color: INK, textDecoration: 'none', padding: '1.9cqw 0', borderBottom: '0.25cqw solid #14141433' }}>
                <div>
                  <div style={{ ...IMPACT, fontSize: '10.4cqw', lineHeight: 0.9, color: RED }}>{day}</div>
                  <div style={{ marginTop: '0.6cqw', fontSize: '1.7cqw', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                    {mon} <span style={{ fontWeight: 400, opacity: 0.6 }}>{wd}</span>
                  </div>
                </div>
                <Art src={d.image} kind="product" tint={TINTS[i % 4]} box={{ width: '25cqw', height: '17.5cqw' }} />
                <div>
                  <Head text={d.title} size="3.5cqw" lines={2} />
                  <p style={{ margin: '1.2cqw 0 0', fontSize: '1.8cqw', letterSpacing: '0.06em' }}>
                    <b style={{ fontWeight: 800 }}>{d.priceInr != null ? `${d.priceNote ? '≈ ' : ''}₹${d.priceInr.toLocaleString('en-IN')}` : 'Price TBA'}</b>
                    <span style={{ opacity: 0.6 }}>
                      {d.timeLabel ? ` · ${d.timeLabel}` : ''} · {CONF[d.confirmation]}
                    </span>
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
      <Folio n={n} />
    </Sheet>
  );
}

function Videos({ p, n }: { p: Extract<MagPage, { t: 'videos' }>; n: number }) {
  const [main, ...others] = p.stories;
  const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const play = (id: string, big: boolean) => (
    <button type="button" data-yt={id} aria-label="Play video" style={{ position: 'absolute', inset: 0, border: 0, padding: 0, cursor: 'pointer', background: `url(${thumb(id)}) center / cover` }}>
      <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: big ? '13cqw' : '8cqw', height: big ? '13cqw' : '8cqw', borderRadius: '50%', background: RED, boxShadow: '0 0 0 1cqw #ffffff55' }}>
        <span style={{ position: 'absolute', left: '53%', top: '50%', transform: 'translate(-50%, -50%)', borderStyle: 'solid', borderWidth: big ? '3cqw 0 3cqw 5cqw' : '2cqw 0 2cqw 3.4cqw', borderColor: 'transparent transparent transparent #fff' }} />
      </span>
    </button>
  );
  return (
    <Sheet bg={INK} color="#fff">
      <RunHead section="Watch" dark />
      <div style={{ position: 'absolute', left: M, right: M, top: '14cqw' }}>
        <Kicker color={YELLOW}>Press play</Kicker>
        <h2 style={{ ...SERIF, fontWeight: 900, fontStyle: 'italic', fontSize: '12cqw', lineHeight: 0.92, margin: '1.4cqw 0 0' }}>{p.title}</h2>
        {main?.video ? (
          <div style={{ marginTop: '5cqw' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000' }}>{play(main.video, true)}</div>
            <h3 style={{ margin: '2.4cqw 0 0' }}>
              <a {...link(main)} style={{ textDecoration: 'none' }}>
                <Head text={main.title} size="4.4cqw" color="#fff" lines={2} />
              </a>
            </h3>
            <p style={{ margin: '1.2cqw 0 0', fontSize: '1.7cqw', letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.6 }}>{main.source}</p>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4cqw', marginTop: '5cqw' }}>
          {others.slice(0, 2).map((s) =>
            s.video ? (
              <div key={s.id}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000' }}>{play(s.video, false)}</div>
                <p style={{ ...SERIF, fontWeight: 700, fontSize: '2.8cqw', lineHeight: 1.14, margin: '1.4cqw 0 0', ...clamp(2) }}>{s.title}</p>
              </div>
            ) : null,
          )}
        </div>
      </div>
      <Folio n={n} dark />
    </Sheet>
  );
}

function Brief({ p, n }: { p: Extract<MagPage, { t: 'brief' }>; n: number }) {
  return (
    <Sheet bg={PAPER}>
      <RunHead section="In brief" />
      <div style={{ position: 'absolute', left: M, right: M, top: '14cqw' }}>
        <h2 style={{ ...SERIF, fontStyle: 'italic', fontWeight: 900, fontSize: '11cqw', lineHeight: 0.95, margin: 0, color: RED }}>{p.title}</h2>
        <ol style={{ listStyle: 'none', margin: '5cqw 0 0', padding: 0, borderTop: `0.35cqw solid ${INK}` }}>
          {p.stories.slice(0, 8).map((s, i) => (
            <li key={s.id} style={{ display: 'grid', gridTemplateColumns: '8cqw 1fr', gap: '2cqw', padding: '1.9cqw 0', borderBottom: '0.25cqw solid #14141433' }}>
              <span style={{ ...SERIF, fontWeight: 900, fontSize: '5.4cqw', color: RED, lineHeight: 1 }}>{i + 1}</span>
              <div>
                <a {...link(s)} style={{ textDecoration: 'none' }}>
                  <Head text={s.title} size="3.1cqw" lines={2} />
                </a>
                <p style={{ margin: '0.8cqw 0 0', fontSize: '1.5cqw', letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.55 }}>{s.source}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <Folio n={n} />
    </Sheet>
  );
}

function Notes({ p, n, slug }: { p: Extract<MagPage, { t: 'notes' }>; n: number; slug: string }) {
  return (
    <Sheet bg={PAPER}>
      <RunHead section="Colophon" />
      <div style={{ position: 'absolute', left: M, right: M, top: '15cqw' }}>
        <Kicker>Colophon</Kicker>
        <h2 style={{ margin: '2cqw 0 0' }}>
          <Head text="How this issue is made." size="9cqw" />
        </h2>
        <div style={{ marginTop: '5cqw', borderTop: `0.35cqw solid ${INK}`, paddingTop: '4cqw' }}>
          {p.lines.map((t, i) => (
            <p key={i} style={{ fontSize: '2.5cqw', lineHeight: 1.7, margin: '0 0 3cqw', color: '#141414cc' }}>
              {t}
            </p>
          ))}
        </div>
        <a href={pdfUrl(slug)} style={{ display: 'inline-block', marginTop: '3cqw', background: RED, color: '#fff', fontSize: '1.9cqw', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '2cqw 3.4cqw', textDecoration: 'none' }}>
          Download this issue (PDF)
        </a>
      </div>
      <Folio n={n} />
    </Sheet>
  );
}

function Back({ p }: { p: Extract<MagPage, { t: 'back' }> }) {
  return (
    <Sheet bg={RED} color="#fff" hard>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '7cqw' }}>
        <div style={{ ...IMPACT, fontSize: '28cqw', lineHeight: 0.85 }}>CHOSN</div>
        <h2 style={{ ...SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: '8.6cqw', margin: '4cqw 0 0' }}>{p.line}</h2>
        <p style={{ margin: '3cqw 0 0', fontSize: '1.9cqw', fontWeight: 800, letterSpacing: '0.26em', textTransform: 'uppercase', opacity: 0.85 }}>{p.masthead}</p>
      </div>
      <div style={{ position: 'absolute', right: '6cqw', bottom: '6cqw' }}>
        <Barcode text="CHOSN-TIMES" />
      </div>
    </Sheet>
  );
}

/** One page of an issue. `n` is its page number (the cover is 1); `slug` is the issue's address. */
export function MagazinePage({ page, n, slug }: { page: MagPage; n: number; slug: string }) {
  switch (page.t) {
    case 'cover': return <Cover p={page} />;
    case 'editor': return <Editor p={page} n={n} />;
    case 'contents': return <Contents p={page} n={n} />;
    case 'feature': return <Feature p={page} n={n} />;
    case 'grid': return <Grid p={page} n={n} />;
    case 'photos': return <Photos p={page} n={n} />;
    case 'drops': return <Drops p={page} n={n} />;
    case 'videos': return <Videos p={page} n={n} />;
    case 'brief': return <Brief p={page} n={n} />;
    case 'notes': return <Notes p={page} n={n} slug={slug} />;
    case 'back': return <Back p={page} />;
  }
}
