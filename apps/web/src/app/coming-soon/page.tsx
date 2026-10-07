import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/Masthead';

export const metadata: Metadata = {
  title: 'Coming soon',
  robots: { index: false, follow: false },
};

/** Shown in place of every page except the landing page while the rest of the site is being built. */
export default function ComingSoonPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Masthead />
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-5 pb-24 text-center">
        <p className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.3em] text-[#0A0A0A]/60">This page is</p>
        <h1 className="mt-4 font-display text-[clamp(4.5rem,15vw,11rem)] uppercase leading-[0.85] tracking-[0.01em] text-[#0A0A0A]">
          Coming
          <br />
          soon.
        </h1>
        <p className="mt-6 max-w-sm text-[1.05rem] font-bold leading-relaxed text-[#0A0A0A]/60">
          We&apos;re building it. Join the waitlist on the home page and we&apos;ll let you know.
        </p>
        <Link
          href="/#join"
          className="btn-shine mt-10 rounded-full bg-[#0A0A0A] px-8 py-4 font-sans text-[0.72rem] font-extrabold uppercase tracking-[0.2em] text-white"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}
