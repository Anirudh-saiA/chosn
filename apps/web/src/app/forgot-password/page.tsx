import type { Metadata } from 'next';
import { Masthead } from '@/components/Masthead';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = { title: 'Reset password | CHOSN' };

export default function ForgotPasswordPage() {
  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-4xl px-6 py-10 lg:py-14">
        <h1 className="font-display text-display-section font-semibold text-text">Reset your password</h1>
        <p className="mt-2 max-w-[46ch] text-body text-text-soft">
          We'll email you a link to set a new one — nothing changes until you use it.
        </p>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
