import Link from 'next/link';

/** Intrinsic aspect ratios of the two logo masks in /public/images (width / height). */
const FULL = 1.219;
const WORD = 5.921;

const mask = (file: string) => ({ ['--m' as string]: `url(/images/${file})` });

/**
 * CHOSN logo, drawn as a colour mask so it follows the surrounding text colour. Everything is sized
 * in `em`, so a className like `!text-[1.9rem]` scales it. By default it is the wordmark (it stays
 * legible at header size); `lockup` draws the full globe with the wordmark across it, for large uses.
 */
export function Logo({ className = '', asLink = true, lockup = false }: { className?: string; asLink?: boolean; lockup?: boolean }) {
  const logo = (
    <span className={`inline-flex items-center text-[1.45rem] leading-none text-text ${className}`}>
      {lockup ? (
        <span aria-hidden className="logo-mask h-[3.6em]" style={{ ...mask('logo-full.png'), aspectRatio: FULL }} />
      ) : (
        <span aria-hidden className="logo-mask h-[0.78em]" style={{ ...mask('logo-word.png'), aspectRatio: WORD }} />
      )}
      <span className="sr-only">CHOSN — home</span>
    </span>
  );
  if (!asLink) return logo;
  return (
    <Link href="/" aria-label="CHOSN home" className="inline-flex min-h-11 min-w-11 items-center">
      {logo}
    </Link>
  );
}
