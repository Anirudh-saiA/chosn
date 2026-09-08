import type { Metadata } from 'next';
import { Archivo, Fraunces, Instrument_Sans, JetBrains_Mono, Zilla_Slab } from 'next/font/google';
import { AuthSessionProvider } from '@/components/auth/AuthSessionProvider';
import { MonitoringProvider } from '@/lib/monitoring';
import './globals.css';

// next/font self-hosts these at build time from Google's font files —
// the deliberate Day 2 choice, served from our own domain either way.
const display = Zilla_Slab({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

// Landing-page-only fork (see docs — a real design-identity decision,
// not a casual addition): Canela/GT Super/Neue Montreal/General Sans
// aren't on Google Fonts (commercial, no self-hostable license via
// next/font), so these are the closest same-CSP-safe alternatives the
// brief's own stated direction explicitly allows. Loaded here, not
// removing display/sans/mono above — every other page keeps Zilla
// Slab/Archivo untouched; only components under components/landing/
// reference font-editorial/font-grotesk.
const editorial = Fraunces({
  subsets: ['latin'],
  weight: ['600', '900'],
  style: ['normal', 'italic'],
  variable: '--font-editorial',
  display: 'swap',
});

const grotesk = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CHOSN',
  description: 'Every sneaker price, tracked in real time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} ${editorial.variable} ${grotesk.variable}`}
    >
      <body>
        <AuthSessionProvider>
          <MonitoringProvider>{children}</MonitoringProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
