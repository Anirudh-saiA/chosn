import type { ReactNode } from 'react';

/** Designed empty / error state: outlined panel, icon slot, title, body, optional action. */
export function EmptyPanel({
  icon,
  title,
  children,
  action,
  className = '',
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel ticks flex flex-col items-center gap-3 px-6 py-14 text-center ${className}`}>
      {icon && <span className="flex h-12 w-12 items-center justify-center border border-brass/30 bg-brass/[0.07] text-brass-bright">{icon}</span>}
      <h2 className="font-display text-2xl font-semibold text-text">{title}</h2>
      {children && <p className="max-w-md text-text-soft">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
