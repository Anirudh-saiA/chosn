import type { Metadata } from 'next';
import { Masthead } from '@/components/Masthead';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = { title: 'Set new password | CHOSN' };

interface PageProps {
  searchParams: Promise<{ email?: string; token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { email, token } = await searchParams;

  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-4xl px-6 py-10 lg:py-14">
        <h1 className="font-display text-display-section font-semibold text-text">Set a new password</h1>
        {email && token ? (
          <div className="mt-8">
            <ResetPasswordForm email={email} token={token} />
          </div>
        ) : (
          <p className="mt-4 text-body text-text-soft">
            This link is missing something — request a new one from the reset page.
          </p>
        )}
      </div>
    </main>
  );
}
