import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { SignUpForm } from '@/components/auth/SignUpForm';

export const metadata: Metadata = { title: 'Create account' };

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Join CHOSN"
      title="Create account"
      description="Free, no card. Track prices, get drop alerts, join the community."
      footer={
        <>
          Already have one?{' '}
          <Link href="/login" className="link-underline font-semibold text-brass-bright">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
