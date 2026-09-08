import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/Masthead';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Sign in | CHOSN' };

export default function LoginPage() {
  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-4xl px-6 py-10 lg:py-14">
        <h1 className="font-display text-display-section font-semibold text-text">Sign in</h1>
        <p className="mt-2 text-body text-text-soft">
          New here?{' '}
          <Link href="/sign-up" className="text-brass hover:underline">
            Create an account
          </Link>
          .
        </p>
        <div className="mt-8">
          <LoginForm googleEnabled={Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)} />
        </div>
      </div>
    </main>
  );
}
