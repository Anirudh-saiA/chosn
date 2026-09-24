import Link from 'next/link';

/** CHOSN wordmark — the O is a liquid-chrome coin ring, the brand's one ornament. */
export function Logo({ className = '', asLink = true }: { className?: string; asLink?: boolean }) {
  const mark = (
    <span className={`inline-flex items-baseline font-display text-[1.45rem] font-semibold leading-none tracking-tight text-text ${className}`}>
      CH
      <span
        aria-hidden
        className="relative mx-[0.03em] inline-block h-[0.74em] w-[0.74em] translate-y-[0.02em] rounded-full border-[0.13em] border-chrome bg-transparent shadow-[0_0_16px_rgba(124,92,255,.55)] before:absolute before:inset-[0.12em] before:rounded-full before:bg-chrome-gradient before:opacity-70"
      />
      SN<span className="sr-only"> — home</span>
    </span>
  );
  if (!asLink) return mark;
  return (
    <Link href="/" aria-label="CHOSN home" className="inline-flex">
      {mark}
    </Link>
  );
}
