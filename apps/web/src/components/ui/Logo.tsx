import Link from 'next/link';

/** Intrinsic aspect ratios of the two logo masks in /public/images (width / height). */
const MARK = 1.048;
const WORD = 6.024;

const mask = (file: string) => ({ ['--m' as string]: `url(/images/${file})` });

/**
 * CHOSN logo: the sneaker-in-a-C mark plus the wordmark, drawn as colour masks so
 * both follow the surrounding text colour. Everything is sized in `em`, so a
 * className like `!text-[1.9rem]` scales the whole lockup.
 */
export function Logo({ className = '', asLink = true }: { className?: string; asLink?: boolean }) {
  const mark = (
    <span className={`inline-flex items-center gap-[0.55em] text-[1.45rem] leading-none text-text ${className}`}>
      <span aria-hidden className="logo-mask h-[1.7em]" style={{ ...mask('logo-mark.png'), aspectRatio: MARK }} />
      <span aria-hidden className="logo-mask h-[0.62em]" style={{ ...mask('logo-word.svg'), aspectRatio: WORD }} />
      <span className="sr-only">CHOSN — home</span>
    </span>
  );
  if (!asLink) return mark;
  return (
    <Link href="/" aria-label="CHOSN home" className="inline-flex">
      {mark}
    </Link>
  );
}
