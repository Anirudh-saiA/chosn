'use client';

import { Check, Plus } from 'lucide-react';
import { COMPARE_MAX, useCompareList, type CompareEntry } from './useCompareList';

/** "Compare" button that adds / removes one shoe from the shared compare list. */
export function CompareToggle({
  entry,
  variant = 'button',
  className = '',
}: {
  entry: CompareEntry;
  /** `button`: labelled pill; `icon`: compact round control for tight rows. */
  variant?: 'button' | 'icon';
  className?: string;
}) {
  const { has, toggle, isFull } = useCompareList();
  const added = has(entry.styleCode);
  const blocked = isFull && !added;
  const label = added ? 'Added to compare' : blocked ? `Compare is full (max ${COMPARE_MAX})` : 'Add to compare';
  const Icon = added ? Check : Plus;

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault(); // may sit inside a link
    e.stopPropagation();
    toggle(entry);
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={blocked}
        aria-pressed={added}
        aria-label={`${label}: ${entry.brand} ${entry.model}`}
        title={label}
        className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors before:absolute before:-inset-1.5 before:content-['']  disabled:cursor-not-allowed disabled:opacity-40 ${
          added ? 'border-text bg-text text-white' : 'border-text/20 bg-white text-text hover:border-text'
        } ${className}`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={blocked}
      aria-pressed={added}
      title={label}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        added ? 'border-text bg-text text-white' : 'border-text/25 bg-white text-text hover:border-text'
      } ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {added ? 'In compare' : 'Compare'}
    </button>
  );
}
