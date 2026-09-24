import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { FormAlert } from '@/components/auth/fields';

export const metadata: Metadata = { title: 'Set new password' };

interface PageProps {
  searchParams: Promise<{ email?: string; token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { email, token } = await searchParams;

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Set a new password"
      footer={
        <Link href="/forgot-password" className="link-underline font-semibold text-brass-bright">
          Request a new link
        </Link>
      }
    >
      {email && token ? (
        <ResetPasswordForm email={email} token={token} />
      ) : (
        <FormAlert>This link is missing something — request a new one from the reset page.</FormAlert>
      )}
    </AuthShell>
  );
}
