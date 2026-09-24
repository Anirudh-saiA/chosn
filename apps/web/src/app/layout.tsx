import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, JetBrains_Mono, Manrope } from 'next/font/google';
import { AuthSessionProvider } from '@/components/auth/AuthSessionProvider';
import { ConsentBanner } from '@/components/ConsentBanner';
import { SmoothScroll } from '@/components/fx/SmoothScroll';
import { MonitoringProvider } from '@/lib/monitoring';
import './globals.css';

// next/font self-hosts these at build time — served from our own domain.
// Obsidian Luxe: Cormorant Garamond (couture display serif) for headlines,
// Manrope for UI/body, JetBrains Mono for every number.
const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'CHOSN — Every sneaker price, tracked in real time', template: '%s' },
  description:
    "Compare sneaker prices across India's retailers and global resale, follow drops, and talk kicks with the community. We never sell — we send you to the best price.",
};

export const viewport: Viewport = {
  themeColor: '#030407',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="grain">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-brass focus:px-4 focus:py-2 focus:font-sans focus:text-ui-label focus:font-semibold focus:text-vault"
        >
          Skip to content
        </a>
        <AuthSessionProvider>
          <SmoothScroll />
          <MonitoringProvider>{children}</MonitoringProvider>
          <ConsentBanner />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
