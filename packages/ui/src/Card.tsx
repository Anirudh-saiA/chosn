import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Which of Day 2's two surfaces this card sits on. Defaults to Vault. */
  surface?: 'vault' | 'chalk';
}

/**
 * Day 2 principle 02 — one hairline border, zero radius, no shadow. Ever.
 * `surface` switches the color pair; the border/radius/shadow treatment
 * itself never changes between them.
 */
export function Card({ surface = 'vault', className, ...props }: CardProps) {
  return (
    <div
      className={cx(
        'border',
        surface === 'vault' && 'border-moss/25 bg-vault-raised text-text',
        surface === 'chalk' && 'border-moss/30 bg-chalk text-text-chalk',
        className,
      )}
      {...props}
    />
  );
}
