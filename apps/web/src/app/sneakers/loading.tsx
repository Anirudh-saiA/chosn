import { BrandLoader } from '@/components/ui/BrandLoader';

/** Shown while search filters navigate (URL-driven, server-fetched). */
export default function Loading() {
  return <BrandLoader label="Finding your sneakers…" />;
}
