import Link from 'next/link';
import { buttonVariantClass } from '@chosn/ui';

export interface EmptyStateProps {
  query?: string;
}

/** Direction, not vagueness (Day 10's writing principle, carried over) — says what to do next. */
export function EmptyState({ query }: EmptyStateProps) {
  return (
    <div className="border border-moss/25 bg-vault-raised p-10 text-center">
      <p className="text-body text-text">
        {query ? (
          <>
            No sneakers match &quot;{query}&quot;.
          </>
        ) : (
          <>No sneakers match these filters.</>
        )}
      </p>
      <p className="mt-1 text-body text-text-soft">Try a different search, or browse everything below.</p>
      <Link href="/sneakers" className={buttonVariantClass('secondary', 'mt-5 inline-flex')}>
        Browse all sneakers
      </Link>
    </div>
  );
}
