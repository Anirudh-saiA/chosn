import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { ShieldCheck, TriangleAlert, UserRound } from 'lucide-react';
import { auth } from '@/auth';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { DeleteAccount } from '@/components/auth/DeleteAccount';
import { ProfileSettings } from '@/components/auth/ProfileSettings';
import { TotpSetup } from '@/components/auth/TotpSetup';

export const metadata: Metadata = { title: 'Account security' };

/**
 * Inherently per-visitor (it's someone's own account settings) — no
 * revalidate/ISR here, unlike almost every other page in this app.
 * `auth()`'s cookie read is exactly right for a route that's dynamic on
 * purpose, the opposite of Masthead's situation (see AuthNavStatus's
 * own comment).
 */
export default async function AccountSecurityPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user as typeof session.user & { displayName?: string | null; avatarSeed?: string };

  return (
    <PageShell width="4xl">
      <PageHeader
        eyebrow="Account"
        title="Security"
        description={
          <>
            Signed in as <span className="font-mono text-text">{session.user.email}</span>
          </>
        }
      />

      <div className="space-y-6">
        <AccountSection icon={<UserRound aria-hidden className="h-4 w-4" />} title="Profile" note="What other members see.">
          <ProfileSettings initialDisplayName={user.displayName ?? null} initialAvatarSeed={user.avatarSeed ?? session.user.id ?? ''} />
        </AccountSection>

        <AccountSection icon={<ShieldCheck aria-hidden className="h-4 w-4" />} title="Two-factor authentication" note="An extra step at sign-in.">
          <TotpSetup />
        </AccountSection>

        <section aria-labelledby="danger-zone" className="border border-rust/40 bg-rust/[0.04] p-6 sm:p-8">
          <h2 id="danger-zone" className="flex items-center gap-2 font-mono text-ui-label font-semibold uppercase tracking-[0.18em] text-rust">
            <TriangleAlert aria-hidden className="h-4 w-4" />
            Danger zone
          </h2>
          <p className="mt-1 font-display text-2xl font-bold text-text">Delete account</p>
          <div className="mt-4">
            <DeleteAccount />
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function AccountSection({ icon, title, note, children }: { icon: ReactNode; title: string; note: string; children: ReactNode }) {
  const id = `sec-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="panel ticks p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">{icon}</span>
        <div>
          <h2 id={id} className="font-display text-2xl font-bold leading-none text-text">
            {title}
          </h2>
          <p className="mt-1 text-meta text-text-faint">{note}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
