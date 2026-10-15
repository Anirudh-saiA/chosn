'use client';

import { useState, type ReactNode } from 'react';

/**
 * A retailer-hosted product photo that never leaves an empty frame behind: if the image can't be loaded
 * (blocked, removed, offline) the `fallback` is shown instead. No referrer is sent, because some image
 * hosts refuse requests that come from another site.
 */
export function ShoePhoto({
  src,
  alt,
  className,
  fallback = null,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />;
}
