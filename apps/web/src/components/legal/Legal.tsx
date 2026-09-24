import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { LegalToc } from './LegalToc';

const ARTICLE_ID = 'legal-article';

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Long-form reading frame: header, sticky TOC (lg+), ~68ch article column. */
export function LegalLayout({
  eyebrow,
  title,
  lede,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: ReactNode;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <PageShell width="6xl">
      <PageHeader eyebrow={eyebrow} title={title} description={lede} className="!mb-8 lg:!mb-12">
        {updated && (
          <p className="border border-text/10 bg-vault-raised/60 px-3 py-2 font-mono text-meta uppercase tracking-[0.14em] text-text-soft">
            Updated <span className="text-text">{updated}</span>
          </p>
        )}
      </PageHeader>
      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-14">
        <div>
          <LegalToc articleId={ARTICLE_ID} />
        </div>
        <article id={ARTICLE_ID} className="min-w-0">
          {children}
        </article>
      </div>
    </PageShell>
  );
}

/** One h2 section. `id` defaults to a slug of the title (anchor + TOC target). */
export function LegalSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id ?? slugify(title)} className="scroll-mt-24 border-t border-text/10 py-9 first:border-t-0 first:pt-0">
      <h2 className="max-w-[28ch] font-display text-[clamp(1.5rem,3vw,2rem)] font-bold leading-tight tracking-tight text-text">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-[1.0625rem] leading-[1.75] text-text-soft [&>*]:max-w-[68ch] [&>div.overflow-x-auto]:max-w-none [&_a]:text-brass-bright [&_a]:underline [&_a]:decoration-brass/40 [&_a]:underline-offset-4 hover:[&_a]:decoration-brass-bright [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-text [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-text [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul>li]:marker:text-brass">
        {children}
      </div>
    </section>
  );
}

/** Notice panel. `tone="warn"` (rust) is used for the pending-legal-review flag. */
export function LegalCallout({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'note' }) {
  return (
    <aside
      className={`mb-9 flex max-w-[68ch] gap-3 border p-4 text-data-inline leading-relaxed text-text-soft [&_code]:font-mono [&_code]:text-text [&_strong]:text-text ${
        tone === 'warn' ? 'border-rust/40 bg-rust/[0.06]' : 'border-brass/30 bg-brass/[0.06]'
      }`}
    >
      <TriangleAlert aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'warn' ? 'text-rust' : 'text-brass-bright'}`} />
      <div>{children}</div>
    </aside>
  );
}
