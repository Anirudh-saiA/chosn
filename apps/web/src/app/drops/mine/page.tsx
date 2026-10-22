import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { MyDrops } from '@/components/drops/MyDrops';

export const metadata: Metadata = { title: 'My drops', description: 'The sneaker drops and brands you follow, with your own calendar link.' };

export default function MyDropsPage() {
  return (
    <PageShell width="7xl">
      <Link href="/releases?tab=drops" className="mb-8 inline-flex min-h-[44px] items-center gap-2 font-mono text-meta uppercase tracking-[0.14em] text-text-soft hover:text-brass-bright">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Releases
      </Link>
      <h1 className="mb-8 font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold leading-none tracking-tight text-text">My drops</h1>
      <MyDrops />
    </PageShell>
  );
}
