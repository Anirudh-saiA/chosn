import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Masthead } from '@/components/Masthead';
import { ProfileSettings } from '@/components/auth/ProfileSettings';
import { TotpSetup } from '@/components/auth/TotpSetup';

export const metadata: Metadata = { title: 'Account security | CHOSN' };

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

  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-4xl px-6 py-10 lg:py-14">
        <h1 className="font-display text-display-section font-semibold text-text">Security</h1>
        <p className="mt-2 text-body text-text-soft">Signed in as {session.user.email}</p>

        <section className="mt-10">
          <h2 className="font-mono text-ui-label font-semibold uppercase tracking-[0.06em] text-text-faint">
            Profile
          </h2>
          <div className="mt-3">
            <ProfileSettings
              initialDisplayName={(session.user as typeof session.user & { displayName?: string | null }).displayName ?? null}
              initialAvatarSeed={(session.user as typeof session.user & { avatarSeed?: string }).avatarSeed ?? session.user.id ?? ''}
            />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-ui-label font-semibold uppercase tracking-[0.06em] text-text-faint">
            Two-factor authentication
          </h2>
          <div className="mt-3">
            <TotpSetup />
          </div>
        </section>
      </div>
    </main>
  );
}
