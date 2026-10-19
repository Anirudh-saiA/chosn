import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { followupMail, welcomeMail, type WaitlistMailContext } from './waitlist-templates';

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

  get enabled(): boolean {
    return this.resend !== null;
  }

  /** A plain transactional mail (wishlist alerts, confirmations). True only when Resend accepted it. */
  async sendMail(to: string, subject: string, html: string, text: string, unsubscribeUrl?: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.debug(`RESEND_API_KEY unset - skipping mail to ${to}`);
      return false;
    }
    const { error } = await this.resend.emails.send({
      from: process.env.RESEND_FROM ?? 'CHOSN <onboarding@resend.dev>',
      replyTo: process.env.RESEND_REPLY_TO || undefined,
      to,
      subject,
      html,
      text,
      headers: unsubscribeUrl ? { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined,
    });
    if (error) {
      this.logger.warn(`resend rejected mail to ${to}: ${error.message}`);
      return false;
    }
    return true;
  }

  /**
   * Returns true only when Resend accepted the message. Resend reports
   * failures in the response (it does not throw), so that has to be
   * checked or a rejected send would be recorded as delivered.
   */
  async sendWaitlistMail(kind: 'welcome' | 'followup', to: string, ctx: WaitlistMailContext): Promise<boolean> {
    if (!this.resend) {
      this.logger.debug(`RESEND_API_KEY unset — skipping ${kind} email to ${to}`);
      return false;
    }

    const { subject, html, text } = kind === 'welcome' ? welcomeMail(ctx) : followupMail(ctx);
    const { error } = await this.resend.emails.send({
      from: process.env.RESEND_FROM ?? 'CHOSN <onboarding@resend.dev>',
      replyTo: process.env.RESEND_REPLY_TO || undefined,
      to,
      subject,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<${ctx.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    if (error) {
      this.logger.warn(`resend rejected ${kind} email to ${to}: ${error.message}`);
      return false;
    }
    return true;
  }
}
