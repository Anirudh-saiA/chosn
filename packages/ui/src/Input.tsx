import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from './cx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Which of Day 2's two surfaces this input sits on. Defaults to Vault. */
  surface?: 'vault' | 'chalk';
}

/**
 * For the waitlist form and anywhere else CHOSN collects text. Focus
 * state uses the text color, not Signal — Signal stays reserved for
 * actual buy/positive states, not generic interaction feedback.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ surface = 'vault', className, ...props }, ref) => (
    <input
      ref={ref}
      className={cx(
        'w-full border px-4 py-3 font-sans text-body outline-none transition-colors duration-150 ease-chosn',
        // moss/40 reads fine on Vault's dark ground but drops under the
        // 3:1 non-text contrast minimum on Chalk's light one — Chalk
        // gets full-strength moss instead of a weaker opacity step.
        surface === 'vault' &&
          'border-moss/40 bg-vault text-text placeholder:text-text-faint focus-visible:border-text',
        surface === 'chalk' &&
          'border-moss bg-chalk text-text-chalk placeholder:text-text-chalk-soft focus-visible:border-text-chalk',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
