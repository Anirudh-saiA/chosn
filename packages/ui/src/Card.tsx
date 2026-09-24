import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Which surface this card sits on. Defaults to Vault. */
  surface?: 'vault' | 'chalk';
}

/**
 * v2: layered vault surface — vertical gradient, hairline border, inner
 * top highlight (`.panel` in globals.css). Still sharp-cornered.
 */
export function Card({ surface = 'vault', className, ...props }: CardProps) {
  return (
    <div
      className={cx(
        surface === 'vault' && 'panel text-text',
        surface === 'chalk' && 'border border-moss/30 bg-chalk text-text-chalk',
        className,
      )}
      {...props}
    />
  );
}
