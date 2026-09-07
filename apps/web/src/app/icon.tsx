import { ImageResponse } from 'next/og';

/**
 * No favicon existed anywhere in the app before this — every page was
 * missing one (Lighthouse's errors-in-console audit flags the resulting
 * 404 on every single page, not just this one). Fixed here rather than
 * scoped to Day 10 alone, since the Masthead wordmark it reuses
 * (Day 4) is already the whole site's identity, not this page's.
 */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F1613',
          color: '#EDEFE7',
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
        }}
      >
        C<span style={{ color: '#C6963C' }}>O</span>
      </div>
    ),
    { ...size },
  );
}
