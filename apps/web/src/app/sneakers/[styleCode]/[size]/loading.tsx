import { PageShell } from '@/components/ui/PageShell';

/** Skeleton for the price comparison page while a variant streams in. */
export default function Loading() {
  return (
    <PageShell width="7xl">
      <div role="status" aria-label="Loading price comparison" className="grid gap-8 lg:grid-cols-[1.05fr_1fr]">
        <div className="skeleton min-h-[340px] lg:min-h-[560px]" />
        <div className="flex flex-col gap-5">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-14 w-3/4" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-56 w-full" />
          <div className="skeleton h-11 w-full" />
        </div>
      </div>
    </PageShell>
  );
}
