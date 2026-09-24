import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from './cx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Which surface this input sits on. Defaults to Vault. */
  surface?: 'vault' | 'chalk';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ surface = 'vault', className, ...props }, ref) => (
    <input
      ref={ref}
      className={cx(
        'w-full border px-4 py-3 font-sans text-body outline-none transition-all duration-200 ease-out',
        surface === 'vault' &&
          'border-text/15 bg-vault-deep/70 text-text placeholder:text-text-faint hover:border-text/30 focus-visible:border-ice focus-visible:bg-vault-deep focus-visible:shadow-[0_0_0_3px_rgba(143,214,255,.18)]',
        surface === 'chalk' &&
          'border-moss bg-chalk text-text-chalk placeholder:text-text-chalk-soft focus-visible:border-text-chalk',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
