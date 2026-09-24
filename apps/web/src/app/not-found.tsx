import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Home } from 'lucide-react';
import { buttonVariantClass } from '@chosn/ui';
import { PageShell } from '@/components/ui/PageShell';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { Reveal } from '@/components/fx/Reveal';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <PageShell width="5xl">
      <div className="relative flex flex-col items-center py-6 text-center lg:py-14">
        <Reveal>
          <p className="eyebrow">Error 404 · Size not found</p>
        </Reveal>

        <div className="relative mt-4 w-full">
          <p
            aria-hidden
            className="text-outline select-none font-display text-[clamp(9rem,32vw,24rem)] font-bold leading-[0.8] tracking-tighter"
          >
            404
          </p>
          <div className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-[min(30rem,64%)] -translate-y-1/2">
            <div className="animate-float">
            <div aria-hidden className="absolute inset-x-6 top-1/2 h-24 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(255,168,0,.35),transparent)] blur-2xl" />
            <SneakerArt colorway="Bred" brand="Jordan" className="relative h-auto w-full -rotate-6 drop-shadow-[0_30px_40px_rgba(0,0,0,.65)]" />
            </div>
          </div>
        </div>

        <Reveal delay={0.1}>
          <h1 className="mt-14 font-display text-[clamp(1.9rem,4.5vw,3rem)] font-bold leading-[1.02] tracking-tight text-text">
            We found the shoe. <span className="text-brass-gradient">Not the page.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[52ch] text-lg text-text-soft">
            This link is out of stock everywhere we check — zero retailers, zero resellers. It may have moved, or it never
            dropped at all.
          </p>
        </Reveal>

        <Reveal delay={0.2} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/sneakers" className={buttonVariantClass('primary', 'min-h-[48px] px-6')}>
            Compare a price
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <Link href="/" className={buttonVariantClass('secondary', 'min-h-[48px] px-6')}>
            <Home aria-hidden className="h-4 w-4" />
            Go home
          </Link>
        </Reveal>
      </div>
    </PageShell>
  );
}
