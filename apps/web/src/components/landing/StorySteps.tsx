import { Reveal } from '@/components/fx/Reveal';

const STEPS = [
  {
    key: 'track',
    n: '01',
    kicker: 'Track',
    title: 'Every retailer. One feed.',
    body: 'Prices from Flipkart, Myntra, Ajio, END. and resale marketplaces land in one canonical listing, keyed by the printed style code — every size, every colourway, refreshed on a schedule you can see.',
    side: 'right' as const,
    points: ['Style-code matching, not fuzzy titles', 'Per-size listings, UK / US / EU converted', 'Freshness shown on every price'],
  },
  {
    key: 'compare',
    n: '02',
    kicker: 'Compare',
    title: 'Landed price, not sticker price.',
    body: 'Shipping, stock and staleness are folded in, so the cheapest row is the cheapest you will actually pay. One dense table, ranked, with a single clear way out to the retailer.',
    side: 'left' as const,
    points: ['Shipping included in every total', 'Out-of-stock rows never lead', 'Deep links to the exact size'],
  },
  {
    key: 'decide',
    n: '03',
    kicker: 'Decide',
    title: 'A signal you can trust.',
    body: 'Each sneaker gets a buy / wait signal computed from its own 30- and 90-day history. When there is not enough data yet, we say so instead of guessing.',
    side: 'right' as const,
    points: ['30- and 90-day averages side by side', 'Honest “gathering history” state', 'Get notified when a price moves'],
  },
];

/**
 * Three full-height scroll beats. Each carries data-stage so the fixed
 * 3D sneaker changes pose (spin, explode, flip) as it passes.
 */
export function StorySteps() {
  return (
    <>
      {STEPS.map((s) => (
        <section
          key={s.n}
          data-stage={s.key}
          className="relative flex min-h-[100svh] items-center py-24"
          aria-labelledby={`step-${s.n}`}
        >
          <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8">
            <div className={`max-w-[34rem] ${s.side === 'right' ? 'lg:ml-auto' : ''}`}>
              <Reveal>
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-[5.5rem] font-bold leading-none text-outline sm:text-[7rem]">{s.n}</span>
                  <span className="eyebrow">{s.kicker}</span>
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <h2 id={`step-${s.n}`} className="mt-4 font-display text-[clamp(2.2rem,5vw,3.75rem)] font-bold leading-[1.02] tracking-tight text-text">
                  {s.title}
                </h2>
              </Reveal>
              <Reveal delay={0.16}>
                <p className="mt-5 text-lg leading-relaxed text-text-soft">{s.body}</p>
              </Reveal>
              <Reveal delay={0.24}>
                <ul className="mt-7 space-y-3">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-ui-label text-text">
                      <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rotate-45 bg-brass" />
                      {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
