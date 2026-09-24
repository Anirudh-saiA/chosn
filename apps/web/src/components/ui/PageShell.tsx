import type { ReactNode } from 'react';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';

const WIDTHS = {
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-[80rem]',
  full: 'max-w-[90rem]',
} as const;

/**
 * Standard page frame for every non-landing route: ambient aurora + grid,
 * the sticky Masthead, a width-capped <main id="main"> (the skip-link
 * target) and the SiteFooter.
 */
export function PageShell({
  children,
  width = '6xl',
  footer = true,
  className = '',
}: {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
  footer?: boolean;
  className?: string;
}) {
  return (
    <div className="page-shell relative">
      <div aria-hidden className="aurora !bottom-auto !h-[85vh] [mask-image:linear-gradient(to_bottom,#000_35%,transparent)]" />
      <div aria-hidden className="grid-lines !bottom-auto !h-[85vh]" />
      <div className="relative z-10">
        <Masthead />
        <main id="main" className={`mx-auto px-5 py-10 sm:px-8 lg:py-14 ${WIDTHS[width]} ${className}`}>
          {children}
        </main>
        {footer && <SiteFooter />}
      </div>
    </div>
  );
}
