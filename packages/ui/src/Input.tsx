import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from './cx';

/**
 * For the waitlist form and anywhere else CHOSN collects text. Focus
 * state uses the text color, not Signal — Signal stays reserved for
 * actual buy/positive states, not generic interaction feedback.
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cx(
        'w-full border border-moss/40 bg-vault px-4 py-3 font-sans text-body text-text outline-none transition-colors duration-150 ease-chosn placeholder:text-text-faint focus-visible:border-text',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
