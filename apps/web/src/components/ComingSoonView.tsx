import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';

/** Full-page placeholder for a section that isn't open yet (see lib/features.ts). */
export function ComingSoonView({ name, blurb }: { name: string; blurb: string }) {
  return (
    <PageShell width="5xl" plain>
      <div className="flex min-h-[58vh] flex-col items-center justify-center text-center">
        <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.3em] text-[#0A0A0A]/60">{name}</p>
        <h1 className="mt-4 font-display text-[clamp(4rem,13vw,10rem)] uppercase leading-[0.85] tracking-[0.01em] text-[#0A0A0A]">
          Coming
          <br />
          soon.
        </h1>
        <p className="mt-6 max-w-md text-[1.05rem] font-bold leading-relaxed text-[#0A0A0A]/60">{blurb}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sneakers"
            className="inline-flex min-h-[48px] items-center rounded-full bg-[#0A0A0A] px-8 font-sans text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-white"
          >
            Compare prices
          </Link>
          <Link
            href="/#join"
            className="inline-flex min-h-[48px] items-center rounded-full border-2 border-[#0A0A0A] px-8 font-sans text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-[#0A0A0A]"
          >
            Join the waitlist
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
