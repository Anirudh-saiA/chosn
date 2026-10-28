import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthSessionProvider } from '@/components/auth/AuthSessionProvider';
import { ConsentBanner } from '@/components/ConsentBanner';
import { WatchSync } from '@/components/watch/WatchSync';
import { FeedbackReminder } from '@/components/feedback/FeedbackReminder';
import { SmoothScroll } from '@/components/fx/SmoothScroll';
import { MonitoringProvider } from '@/lib/monitoring';
import './globals.css';

// next/font self-hosts Inter at build time, served from our own domain. One family for the whole site (brand rule).
// The old --font-display / --font-impact / --font-hand variables are kept as aliases of it in globals.css.
const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'CHOSN — Every sneaker price, tracked in real time', template: '%s' },
  description:
    "Compare sneaker prices across India's retailers and global resale, follow drops, and talk kicks with the community. We never sell — we send you to the best price.",
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable}`}
    >
      <body className="grain">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-black focus:px-4 focus:py-3 focus:font-sans focus:text-ui-label focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <AuthSessionProvider>
          <SmoothScroll />
          <MonitoringProvider>{children}</MonitoringProvider>
          <WatchSync />
          <FeedbackReminder />
          <ConsentBanner />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
