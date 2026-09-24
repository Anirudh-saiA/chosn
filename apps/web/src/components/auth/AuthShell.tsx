import type { ReactNode } from 'react';
import { BellRing, LockKeyhole, ShieldCheck, TrendingDown } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Logo } from '@/components/ui/Logo';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { Reveal } from '@/components/fx/Reveal';

const TRUST = [
  { icon: TrendingDown, text: 'Every price, every retailer, one honest number.' },
  { icon: BellRing, text: 'Drop and price-fall alerts, only when you ask.' },
  { icon: LockKeyhole, text: 'No ads, no data sales. Delete your account in one click.' },
];

/**
 * Split-screen frame for every auth route: brand panel (lg+) on the
 * left, the form card on the right. The card carries the page <h1>.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <PageShell width="7xl" className="!py-6 lg:!py-10">
      <div className="grid gap-6 lg:min-h-[min(760px,calc(100svh-9rem))] lg:grid-cols-[1.05fr_1fr]">
        <aside aria-label="About CHOSN" className="panel relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10">
          <div aria-hidden className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,168,0,.35),transparent)] blur-2xl" />
          <div aria-hidden className="absolute -bottom-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,rgba(46,242,166,.22),transparent)] blur-2xl" />
          <div aria-hidden className="grid-lines" />
          <div className="relative">
            <Logo className="!text-[1.9rem]" />
          </div>
          <div className="relative my-6">
            <div className="mx-auto w-[92%] animate-float">
              <SneakerArt colorway="Bred" brand="Jordan" className="h-auto w-full drop-shadow-[0_30px_40px_rgba(0,0,0,.6)]" />
            </div>
          </div>
          <div className="relative">
            <p className="eyebrow">The price of every pair</p>
            <p className="mt-3 max-w-[18ch] font-display text-4xl font-bold leading-[1.02] tracking-tight text-text">
              Buy at the <span className="text-brass-gradient">right</span> price.
            </p>
            <ul className="mt-7 space-y-3.5">
              {TRUST.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-[0.9375rem] text-text-soft">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <Reveal y={16} className="flex">
          <div className="panel ticks flex w-full flex-col justify-center px-5 py-8 sm:px-10 sm:py-12"><div>
            <p className="eyebrow flex items-center gap-2">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
              {eyebrow}
            </p>
            <h1 className="mt-3 font-display text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.02] tracking-tight text-text">{title}</h1>
            {description && <p className="mt-3 max-w-[46ch] text-body text-text-soft">{description}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 border-t border-text/10 pt-6 text-data-inline text-text-soft">{footer}</div>}
          </div></div>
        </Reveal>
      </div>
    </PageShell>
  );
}
