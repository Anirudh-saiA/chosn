import { BrandLoader } from '@/components/ui/BrandLoader';

/** Root loading UI: shown while any route without its own loading.tsx renders. */
export default function Loading() {
  return <BrandLoader />;
}
