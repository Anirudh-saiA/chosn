import { Reveal } from '@/components/fx/Reveal';
import { shoeById } from './shoes';

/** 02 Discover: just the heading, one line of copy and the shoe, set off from 01 by a rule. */
export function DropsBlock({ shoeId }: { shoeId: string }) {
  const s = shoeById(shoeId);
  return (
    <section id="drops" data-ambient={s.id} className="mx-auto w-full max-w-[90rem] px-5 py-12 sm:px-8">
      <div className="mb-14 h-[2px] w-full bg-[#0A0A0A]" aria-hidden />
      <div className="grid items-center gap-8 lg:grid-cols-12">
        <div className="order-2 lg:order-1 lg:col-span-5 lg:pr-6">
          <Reveal>
            <div className="flex items-end gap-5">
              <span
                aria-hidden
                className="font-display text-[clamp(4rem,8vw,6.5rem)] leading-[0.82] tracking-[0.01em] text-[#0A0A0A]"
              >
                02
              </span>
              <h2 className="pb-1 font-display text-[clamp(2.8rem,5.6vw,4.6rem)] font-normal uppercase leading-[0.92] tracking-[0.01em] text-[#0A0A0A]">
                discover.
              </h2>
            </div>
            <p className="mt-6 max-w-sm text-[1.05rem] font-bold leading-relaxed text-text-soft">
              Every confirmed release on the calendar, with a live countdown — so you know the minute it opens.
            </p>
          </Reveal>
        </div>

        <Reveal className="order-1 lg:order-2 lg:col-span-7">
          <div className="glass-card glass-lift relative flex min-h-[24rem] items-center justify-center lg:min-h-[32rem]" style={{ background: s.bg }}>
            <div className="relative aspect-[2/1] w-[88%]">
              <div className="shoe-float absolute inset-0">
                <img
                  src={s.src}
                  alt={s.alt}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="h-full w-full select-none object-contain drop-shadow-[0_24px_24px_rgba(0,0,0,0.35)]"
                />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
