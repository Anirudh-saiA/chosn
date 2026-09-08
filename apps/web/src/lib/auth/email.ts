import { Resend } from 'resend';

/** Same no-op-until-configured convention as apps/api's EmailService (RESEND_API_KEY) — the reset flow works end-to-end either way, it just logs the link instead of emailing it until a real key exists. */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY unset — password reset link for ${email}: ${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'CHOSN <onboarding@resend.dev>',
    to: email,
    subject: 'Reset your CHOSN password',
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;">
        <p style="font-size:16px;">Someone asked to reset the password on this CHOSN account.</p>
        <p><a href="${resetUrl}">Reset your password</a> — this link expires in 1 hour.</p>
        <p style="font-size:13px;color:#999;">If this wasn't you, nothing else needs to happen — your password hasn't changed.</p>
      </div>
    `,
  });
}
