import { Reveal } from '@/components/fx/Reveal';
import { BrandGrid } from './BrandGrid';
import { ScrollHighlight } from './ScrollHighlight';
import { ShoeWheel } from './ShoeWheel';
import { shoeById } from './shoes';

/** 02 Discover: highlighted lead line + brand logos on top, the shoe centred below. */
export function DropsBlock({ shoeId }: { shoeId: string }) {
  const s = shoeById(shoeId);
  return (
    <section id="drops" data-ambient={s.id} className="mx-auto w-full max-w-[90rem] px-5 pb-20 pt-10 sm:px-8">
      <Reveal>
        <h2 className="sr-only">Discover</h2>
        <div className="mb-12 flex flex-wrap items-start justify-between gap-8 border-b-2 border-[#0A0A0A] pb-8">
          <ScrollHighlight
            before="Every"
            first="confirmed release"
            between=" on the calendar, with a "
            second="live countdown"
            after="— so you know the minute it opens."
          />
          <BrandGrid />
        </div>
      </Reveal>

      <Reveal>
        <ShoeWheel />
      </Reveal>
    </section>
  );
}
