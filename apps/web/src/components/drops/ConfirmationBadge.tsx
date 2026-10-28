import type { DropConfirmation } from '@/lib/drops';

const LOOK: Record<DropConfirmation, { label: string; tip: string; cls: string }> = {
  confirmed: { label: 'Confirmed', tip: 'A brand or retailer page states this date', cls: 'border-[#0A6B44] bg-[#E3F3E9] text-[#0A6B44]' },
  reported: { label: 'Reported', tip: 'Release trackers agree on this date; no official page checked yet', cls: 'border-[#0A0A0A]/40 bg-white text-[#0A0A0A]' },
  unconfirmed: { label: 'Unconfirmed', tip: 'One source, or sources disagree. Treat the date as a lead', cls: 'border-[#B3121F] bg-white text-[#B3121F]' },
};

/** How firm a drop's date is. Nothing is shown without it, so a lead is never mistaken for a confirmed date. */
export function ConfirmationBadge({ level = 'confirmed' }: { level?: DropConfirmation }) {
  const l = LOOK[level];
  return (
    <span title={l.tip} className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.6rem] font-extrabold uppercase tracking-[0.14em] ${l.cls}`}>
      {l.label}
    </span>
  );
}
