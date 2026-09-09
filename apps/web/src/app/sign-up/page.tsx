import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { SignUpForm } from '@/components/auth/SignUpForm';

export const metadata: Metadata = { title: 'Create account | CHOSN' };

export default function SignUpPage() {
  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-4xl px-6 py-10 lg:py-14">
        <h1 className="font-display text-display-section font-semibold text-text">Create account</h1>
        <p className="mt-2 text-body text-text-soft">
          Already have one?{' '}
          <Link href="/login" className="text-brass hover:underline">
            Sign in
          </Link>
          .
        </p>
        <div className="mt-8">
          <SignUpForm />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
