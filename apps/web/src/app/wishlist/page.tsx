import type { Metadata } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { WishlistView } from '@/components/wishlist/WishlistView';

export const metadata: Metadata = {
  title: 'Wishlist',
  description: 'Sneakers you have saved on CHOSN.',
};

export default function WishlistPage() {
  return (
    <PageShell width="7xl">
      <WishlistView />
    </PageShell>
  );
}
