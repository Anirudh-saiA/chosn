import QRCode from 'qrcode';
import { NextResponse } from 'next/server';
import { generateTotpEnrollment } from '@/lib/auth/totp';
import { requireSession } from '@/lib/auth/require-session';

/** Generates a new secret and its QR code — not persisted or enabled yet; see /api/auth/totp/enable for the step that actually turns MFA on. */
export async function POST(): Promise<Response> {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { secretBase32, otpauthUri } = generateTotpEnrollment(session.email);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

  return NextResponse.json({ secretBase32, qrCodeDataUrl });
}
