import { PageShell } from '@/components/ui/PageShell';
import { SneakerCardSkeleton } from '@/components/search/SneakerCard';

/** Skeleton for the search page while filters navigate (URL-driven, server-fetched). */
export default function Loading() {
  return (
    <PageShell width="7xl">
      <div role="status" aria-label="Loading sneakers">
        <div className="mb-10 space-y-4">
          <div className="skeleton h-3 w-40" />
          <div className="skeleton h-16 w-full max-w-md" />
        </div>
        <div className="skeleton mb-8 h-[110px] w-full" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <SneakerCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
