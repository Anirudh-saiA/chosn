import { PageShell } from '@/components/ui/PageShell';

/** Grey placeholder block (pure black and white look: flat light grey, gentle pulse; frozen under reduced motion by globals.css). */
export function Bone({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

function Status({ label }: { label: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {label}
    </p>
  );
}

/** Heading block shared by the page skeletons: a short kicker, a big title and one line of copy. */
function HeadBones() {
  return (
    <div className="space-y-4">
      <Bone className="h-3 w-24 rounded-full" />
      <Bone className="h-12 w-3/4 max-w-md rounded-2xl sm:h-16" />
      <Bone className="h-5 w-full max-w-xl rounded-full" />
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-[20px] border border-text/10 bg-white p-3 sm:p-4">
          <Bone className="h-3 w-12 rounded-full" />
          <Bone className="mt-3 h-4 w-4/5 rounded-full" />
          <Bone className="mt-2 h-4 w-1/3 rounded-full" />
          <Bone className="mt-4 aspect-[4/3] w-full rounded-2xl" />
          <Bone className="mt-4 h-8 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Whole-page skeleton for lists (sneakers, releases, community). */
export function ListPageSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <PageShell>
      <Status label={label} />
      <HeadBones />
      <div className="mt-8 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="h-11 w-16 shrink-0 rounded-full" />
        ))}
      </div>
      <CardGridSkeleton />
    </PageShell>
  );
}

/** Price / compare page skeleton: gallery on the left, price block and store rows on the right. */
export function PricePageSkeleton() {
  return (
    <PageShell>
      <Status label="Loading prices" />
      <Bone className="h-4 w-56 rounded-full" />
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <Bone className="aspect-square w-full rounded-3xl" />
        <div className="space-y-4">
          <Bone className="h-3 w-24 rounded-full" />
          <Bone className="h-12 w-3/4 rounded-2xl" />
          <Bone className="h-5 w-1/3 rounded-full" />
          <Bone className="h-28 w-full rounded-3xl" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => (
              <Bone key={i} className="h-11 rounded-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-10 space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-20 w-full rounded-[20px]" />
        ))}
      </div>
    </PageShell>
  );
}
