import type { ReactNode } from 'react';
import { Reveal } from '@/components/fx/Reveal';

/** Consistent page title block: mono eyebrow, big display title, lede, optional actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className = '',
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** right-aligned actions (buttons, filters) */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-10 flex flex-wrap items-end justify-between gap-6 lg:mb-14 ${className}`}>
      <div className="max-w-3xl">
        {eyebrow && (
          <Reveal>
            <p className="eyebrow">{eyebrow}</p>
          </Reveal>
        )}
        <Reveal delay={0.05}>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[0.98] tracking-tight text-text">{title}</h1>
        </Reveal>
        {description && (
          <Reveal delay={0.1}>
            <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-text-soft">{description}</p>
          </Reveal>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}
