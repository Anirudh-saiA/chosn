import Link from 'next/link';
import { formatInr, formatSize, type ColourOption } from '@/lib/catalog';
import { ShoePhoto } from '@/components/ui/ShoePhoto';

/**
 * The model's other colours as a row of small photos under the name: one shoe, pick the colour. Each opens that
 * colour's page in the same size when it has it (otherwise its cheapest in-stock size). Hidden for one-colour models.
 */
export function ColourPicker({ colours, size }: { colours: ColourOption[]; size: number }) {
  if (colours.length < 2) return null;
  const current = colours.find((c) => c.current) ?? colours[0]!;

  return (
    <nav aria-label="Choose a colour" className="mt-5">
      <p className="text-[0.95rem] text-text-soft">
        Colour: <strong className="font-bold text-text">{current.colorway}</strong>
      </p>
      <ul className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1">
        {colours.map((c) => {
          const openSize = c.sizesInStock.includes(size) ? size : c.defaultSize;
          const label = `${c.colorway}${c.bestAvailablePrice !== null ? ` · ${formatInr(c.bestAvailablePrice)}` : ''}${c.sizesInStock.length > 0 && !c.sizesInStock.includes(size) ? ` · opens UK ${formatSize(openSize)}` : ''}`;
          return (
            <li key={c.styleCode} className="shrink-0">
              <Link
                href={`/sneakers/${encodeURIComponent(c.styleCode)}/${formatSize(openSize)}`}
                aria-current={c.current ? 'true' : undefined}
                aria-label={label}
                title={label}
                className={`block h-[4.25rem] w-[4.25rem] overflow-hidden rounded-2xl bg-white transition-shadow ${c.current ? 'ring-2 ring-text' : 'ring-1 ring-text/20 hover:ring-text/60'}`}
              >
                {c.primaryImageUrl && <ShoePhoto key={c.primaryImageUrl} src={c.primaryImageUrl} alt="" className="h-full w-full object-contain p-1.5" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
