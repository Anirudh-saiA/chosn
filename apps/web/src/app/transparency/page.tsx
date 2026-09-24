import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Clock, EyeOff, Gavel, Scale } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { CountUp } from '@/components/fx/CountUp';
import { Reveal } from '@/components/fx/Reveal';

export const metadata: Metadata = {
  title: 'Transparency',
  description: "CHOSN's commitment to publishing aggregate trust & safety enforcement numbers.",
};

export const revalidate = 3600;

const STATS = [
  { to: 4, label: 'Reports a year', note: 'Published quarterly' },
  { to: 6, label: 'Report categories', note: 'Harassment to spam' },
  { to: 4, label: 'Metrics per report', note: 'At minimum' },
  { to: 0, label: 'Individuals identified', note: 'Ever, by design' },
];

const PUBLISHED = [
  { icon: BarChart3, text: 'Total reports received, broken down by reason (harassment, doxxing, scam, hate speech, spam, other)' },
  { icon: Scale, text: 'How many were actioned, dismissed, or are still under review at the close of the quarter' },
  { icon: Clock, text: 'Median and 90th-percentile time from a report being filed to a first review' },
  { icon: Gavel, text: 'Account-level enforcement actions taken (warnings, restrictions, terminations), as a count — never tied to identifying detail about who' },
];

export default function TransparencyPage() {
  return (
    <PageShell width="4xl">
      <PageHeader eyebrow="Trust &amp; safety" title="Transparency" />

      <dl className="mb-12 grid grid-cols-2 gap-px border border-text/10 bg-text/10 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="bg-vault px-5 py-6">
            <dt className="font-mono text-meta uppercase tracking-[0.14em] text-text-soft">{s.label}</dt>
            <dd className="mt-3 font-mono text-4xl font-medium text-brass-bright sm:text-5xl">
              <CountUp to={s.to} />
            </dd>
            <dd className="mt-1 text-meta text-text-faint">{s.note}</dd>
          </div>
        ))}
      </dl>

      <div className="flex max-w-[68ch] flex-col gap-6 text-[1.0625rem] leading-[1.75] text-text-soft [&_strong]:font-semibold [&_strong]:text-text">
        <Reveal>
          <p>
            Task 8 of Day 17&apos;s brief, and a real commitment: once CHOSN&apos;s{' '}
            <Link href="/community-guidelines" className="text-brass-bright underline decoration-brass/40 underline-offset-4 hover:decoration-brass-bright">
              Community Guidelines
            </Link>{' '}
            are actually being enforced against real reports — not the empty queue this launches with — we
            will publish a quarterly report here covering, at minimum:
          </p>
        </Reveal>
        <ul className="grid gap-3">
          {PUBLISHED.map(({ icon: Icon, text }, i) => (
            <Reveal key={text} as="li" delay={i * 0.05}>
              <div className="panel flex items-start gap-4 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">
                  <Icon aria-hidden className="h-4 w-4" />
                </span>
                <span className="text-[0.9375rem] leading-relaxed">{text}</span>
              </div>
            </Reveal>
          ))}
        </ul>

        <aside className="flex gap-3 border border-brass/30 bg-brass/[0.06] p-5">
          <EyeOff aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brass-bright" />
          <p>
            <strong>What this will never include:</strong> anything that identifies an individual reporter or
            reported account, the specific content of any report, or enough detail about a single incident to
            let it be reverse-identified from context. The point is showing that enforcement is happening and
            roughly how much of it, not turning moderation outcomes into public record for individual members
            — that would itself work against the doxxing/deanonymization protections these guidelines exist
            to provide.
          </p>
        </aside>

        <p>
          <strong>Status right now:</strong> the reporting and moderation infrastructure this commitment
          depends on shipped today (Day 17) — see{' '}
          <a
            href="https://github.com/Anirudh-saiA/chosn"
            className="text-brass-bright underline decoration-brass/40 underline-offset-4 hover:decoration-brass-bright"
            target="_blank"
            rel="noreferrer"
          >
            the repository
          </a>{' '}
          — but there is no real report history yet to summarize. The first published report will follow
          the first full quarter after community features that generate meaningful report volume are live.
          This page will be updated with that first report rather than treated as a placeholder to forget
          about.
        </p>
      </div>
    </PageShell>
  );
}
