import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/Masthead';

export const metadata: Metadata = {
  title: 'Transparency | CHOSN',
  description: "CHOSN's commitment to publishing aggregate trust & safety enforcement numbers.",
};

export const revalidate = 3600;

export default function TransparencyPage() {
  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-3xl px-6 py-10 lg:py-14">
        <p className="font-mono text-ui-label uppercase tracking-[0.06em] text-text-faint">Trust &amp; safety</p>
        <h1 className="mt-2 font-display text-display-section font-semibold text-text">Transparency</h1>

        <div className="mt-6 flex max-w-[65ch] flex-col gap-4 text-body text-text-soft [&_strong]:text-text">
          <p>
            Task 8 of Day 17's brief, and a real commitment: once CHOSN's{' '}
            <Link href="/community-guidelines" className="text-brass underline underline-offset-2">
              Community Guidelines
            </Link>{' '}
            are actually being enforced against real reports — not the empty queue this launches with — we
            will publish a quarterly report here covering, at minimum:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Total reports received, broken down by reason (harassment, doxxing, scam, hate speech, spam, other)</li>
            <li>How many were actioned, dismissed, or are still under review at the close of the quarter</li>
            <li>Median and 90th-percentile time from a report being filed to a first review</li>
            <li>Account-level enforcement actions taken (warnings, restrictions, terminations), as a count — never tied to identifying detail about who</li>
          </ul>
          <p>
            <strong>What this will never include:</strong> anything that identifies an individual reporter or
            reported account, the specific content of any report, or enough detail about a single incident to
            let it be reverse-identified from context. The point is showing that enforcement is happening and
            roughly how much of it, not turning moderation outcomes into public record for individual members
            — that would itself work against the doxxing/deanonymization protections these guidelines exist
            to provide.
          </p>
          <p>
            <strong>Status right now:</strong> the reporting and moderation infrastructure this commitment
            depends on shipped today (Day 17) — see{' '}
            <a
              href="https://github.com/Anirudh-saiA/chosn"
              className="text-brass underline underline-offset-2"
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
      </div>
    </main>
  );
}
