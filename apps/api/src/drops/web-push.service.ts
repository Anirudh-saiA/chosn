import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';

export type PushOutcome = { status: 'sent' } | { status: 'gone' } | { status: 'error'; message: string };

/**
 * Thin wrapper over the `web-push` library — same no-op-until-configured
 * convention as EmailService (RESEND_API_KEY) and every retailer adapter
 * (unset credentials = fixture/no-op mode, reported honestly, never
 * silently pretending to have sent something).
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  readonly configured: boolean;

  constructor() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:hello@chosn.app';

    this.configured = Boolean(publicKey && privateKey);
    if (this.configured) {
      webpush.setVapidDetails(subject, publicKey!, privateKey!);
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY unset — web push runs in no-op mode');
    }
  }

  /**
   * Never throws — every outcome (sent, the endpoint is gone, or some
   * other error) comes back as a typed result so the caller can act
   * per-subscription without a try/catch at every call site. `gone`
   * (404/410) means the browser's own push service says this endpoint
   * will never work again — the caller should delete the row, not
   * retry it.
   */
  async send(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: Record<string, unknown>,
  ): Promise<PushOutcome> {
    if (!this.configured) return { status: 'error', message: 'web push not configured' };

    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      return { status: 'sent' };
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) return { status: 'gone' };
      return { status: 'error', message: (err as Error).message };
    }
  }
}
