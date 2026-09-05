import { buttonVariantClass } from '@chosn/ui';
import { PriceTicker } from './PriceTicker';

/**
 * Day 2's asymmetric hero, decided against a centered layout on
 * purpose: a centered headline-over-button is the one pattern every
 * SaaS landing page shares, and a real, moving data object in the
 * other half of the fold proves CHOSN is a data product in the first
 * frame — before a word of copy is read.
 *
 * Mobile: the ticker drops below the text, full width, rather than
 * squeezing the two-column split sideways. A horizontal ticker reads
 * naturally at any width — unlike a cursor-tilt or hover effect, it
 * has no dependency on pointer input or wide layout to make sense.
 */
export function Hero() {
  return (
    <section className="border-b border-moss/20 bg-vault">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-28">
        <div className="flex flex-col items-start gap-6">
          <h1 className="text-balance font-display text-[2.25rem] font-bold leading-[1.1] tracking-[-0.01em] text-text sm:text-[3rem] sm:leading-[1.08] lg:text-display-hero lg:leading-[1.03]">
            Every sneaker price,
            <br />
            tracked in real time.
          </h1>
          <p className="max-w-[46ch] text-body text-text-soft">
            Compare prices across India&apos;s retailers and global resale, before you buy.
          </p>
          <a href="#how-it-works" className={buttonVariantClass('primary')}>
            Compare a price
          </a>
        </div>

        <PriceTicker />
      </div>
    </section>
  );
}
