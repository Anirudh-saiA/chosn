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
    'inline-flex items-center justify-center border px-5 py-[11px] font-sans text-ui-label font-semibold transition-colors duration-150 ease-chosn disabled:pointer-events-none disabled:opacity-40',
    variant === 'primary' && 'border-brass bg-brass text-vault hover:bg-brass/90',
    variant === 'secondary' && 'border-moss/40 bg-vault-raised text-text hover:border-moss',
    variant === 'ghost' && 'border-transparent bg-transparent text-text hover:border-moss/40',
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
