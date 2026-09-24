import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@chosn/ui';
import { TiltCard } from '@/components/fx/TiltCard';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { formatInr, SIGNAL_COPY, type SearchResultItem } from '@/lib/catalog';
import { paletteFor } from '@/lib/sneaker/palette';

/**
 * The catalog card. Designed sneaker art tinted from the colourway sits
 * on a spotlight of the shoe's own colour; the tilt + glare is pure
 * progressive enhancement (static on touch / reduced motion).
 */
export function SneakerTile({ item, priority = false }: { item: SearchResultItem; priority?: boolean }) {
  const palette = paletteFor(item.colorway, item.brand);
  const signal = item.signal ? SIGNAL_COPY[item.signal] : null;
  const href = `/sneakers/${encodeURIComponent(item.styleCode)}/${item.defaultSize}`;

  return (
    <TiltCard max={6}>
      <Link
        href={href}
        prefetch={priority}
        className="edge-glow ticks panel group relative flex h-full flex-col overflow-hidden transition-colors duration-300 hover:bg-vault-high"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-vault-deep/70">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: `radial-gradient(60% 60% at 50% 62%, ${palette.glow}55, transparent 72%)` }}
          />
          <div aria-hidden className="grid-lines !opacity-40" />
          <SneakerArt
            colorway={item.colorway}
            brand={item.brand}
            palette={palette}
            className="absolute inset-0 m-auto h-[82%] w-[88%] transition-transform duration-500 ease-out group-hover:-rotate-3 group-hover:scale-[1.06]"
          />
          {signal && (
            <span className="absolute left-3 top-3">
              <Badge state={signal.badge} className="!px-2.5 !py-0.5 !text-[0.7rem]">
                {signal.label}
              </Badge>
            </span>
          )}
          <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center border border-text/15 bg-vault-deep/70 text-text-soft opacity-0 backdrop-blur transition-all duration-300 group-hover:opacity-100 group-hover:text-brass-bright">
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">{item.brand}</p>
            <h3 className="mt-1 font-display text-xl font-semibold leading-tight text-text">{item.model}</h3>
            <p className="mt-0.5 truncate text-meta text-text-soft">{item.colorway}</p>
          </div>
          <div className="mt-auto flex items-end justify-between gap-3 border-t border-text/[0.07] pt-3">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-faint">Best price</p>
              <p className="font-mono text-data-hero !text-[1.6rem] font-medium leading-none text-text">
                {item.bestAvailablePrice != null ? formatInr(item.bestAvailablePrice) : '—'}
              </p>
            </div>
            <p className="font-mono text-meta text-text-faint">{item.styleCode}</p>
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}
