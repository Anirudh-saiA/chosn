import { PageShell } from '@/components/ui/PageShell';

/** Skeleton for the community routes: header block + three card silhouettes. */
export default function CommunityLoading() {
  return (
    <PageShell width="6xl">
      <div role="status" aria-label="Loading community">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-4 h-14 w-2/3 max-w-md" />
        <div className="skeleton mt-4 h-5 w-full max-w-lg" />
        <div className="mt-12 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-10 w-28" />
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-5 lg:max-w-[calc(100%-20rem)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="panel p-6">
              <div className="flex items-center gap-3">
                <div className="skeleton h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <div className="skeleton h-3 w-32" />
                  <div className="skeleton mt-2 h-3 w-16" />
                </div>
              </div>
              <div className="skeleton mt-5 h-7 w-4/5" />
              <div className="skeleton mt-3 h-4 w-full" />
              <div className="skeleton mt-5 h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
