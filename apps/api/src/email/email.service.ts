import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

const CONFIRMATION_HTML = `
<div style="background:#F6F5F1;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #ddd;padding:32px;">
    <p style="font-size:20px;font-weight:bold;color:#141414;margin:0 0 24px;letter-spacing:0.02em;">
      CH<span style="color:#C6963C;">O</span>SN
    </p>
    <p style="font-size:16px;color:#141414;margin:0 0 16px;">You're on the list.</p>
    <p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 16px;">
      We'll email you the moment community access opens — drop alerts,
      restock pings, and everything else, sent to this address.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#555;margin:0;">No action needed right now.</p>
    <p style="font-size:13px;color:#999;margin:32px 0 0;">— CHOSN</p>
  </div>
</div>
`.trim();

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    // No-ops until RESEND_API_KEY is set — same pattern as Sentry and
    // PostHog elsewhere in this codebase: the pipe works today, it
    // just doesn't send anywhere until a real key exists.
    this.resend = key ? new Resend(key) : null;
  }

  async sendWaitlistConfirmation(email: string): Promise<void> {
    if (!this.resend) {
      this.logger.debug(`RESEND_API_KEY unset — skipping confirmation email to ${email}`);
      return;
    }

    await this.resend.emails.send({
      from: process.env.RESEND_FROM ?? 'CHOSN <onboarding@resend.dev>',
      to: email,
      subject: "You're on the CHOSN waitlist",
      html: CONFIRMATION_HTML,
    });
  }
}
