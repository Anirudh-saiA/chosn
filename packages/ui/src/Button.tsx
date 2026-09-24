import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/**
 * The visual treatment, exported standalone — a CTA that navigates
 * (an <a>, a Next.js Link) should render as a real link, not a
 * <button>, for keyboard and screen-reader semantics. This lets
 * callers style one directly with the exact same classes instead of
 * either forcing everything through <button> or duplicating them.
 *
 * Day 2 principle 04 — "Signal is earned; Brass is the brand." The
 * Day 2 sample-copy block put Signal green on the primary CTA, which
 * is exactly the decorative use the principle rules out. Corrected
 * here: primary is filled Brass (CHOSN's actual identifying color);
 * Signal never appears on a button — it's reserved for Badge and
 * PriceFigure trend states.
 */
export function buttonVariantClass(variant: ButtonVariant = 'secondary', className?: string) {
  return cx(
    'group/btn relative inline-flex select-none items-center justify-center gap-2 overflow-hidden border px-5 py-[11px] font-sans text-ui-label font-semibold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice focus-visible:ring-offset-2 focus-visible:ring-offset-vault-deep disabled:pointer-events-none disabled:opacity-40',
    // v2: primary is a lit brass slab — gradient + inner highlight, glow on hover.
    variant === 'primary' &&
      'border-brass-bright/40 bg-brass-gradient text-vault-deep shadow-inset hover:-translate-y-px hover:shadow-glow-brass active:translate-y-0',
    variant === 'secondary' &&
      'border-text/15 bg-vault-raised/70 text-text backdrop-blur hover:border-chrome/50 hover:bg-vault-high hover:text-white',
    variant === 'ghost' && 'border-transparent bg-transparent text-text-soft hover:border-text/15 hover:text-text',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', className, ...props }, ref) => (
    <button ref={ref} className={buttonVariantClass(variant, className)} {...props} />
  ),
);
Button.displayName = 'Button';
