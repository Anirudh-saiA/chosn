import type { Metadata } from 'next';
import { Archivo, JetBrains_Mono, Zilla_Slab } from 'next/font/google';
import { PostHogProvider } from '@/lib/posthog-provider';
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

export const metadata: Metadata = {
  title: 'CHOSN',
  description: 'Every sneaker price, tracked in real time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
