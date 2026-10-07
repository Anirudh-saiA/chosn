import { BrandLoader } from '@/components/ui/BrandLoader';

/** Shown while a price comparison variant streams in. */
export default function Loading() {
  return <BrandLoader label="Comparing every price…" />;
}
