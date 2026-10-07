import type { SVGProps } from 'react';

/** Minimal gift-box wishlist icon (redrawn as a clean stroke SVG; follows the surrounding text colour). */
export function WishlistIcon({ strokeWidth = 1.8, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {/* bow */}
      <path d="M12 6.4C12 3.2 9.6 1.4 7.8 2.3 6 3.2 6.6 6.4 12 6.4z" />
      <path d="M12 6.4c0-3.2 2.4-5 4.2-4.1 1.8.9 1.2 4.1-4.2 4.1z" />
      {/* lid */}
      <rect x="3" y="6.4" width="18" height="4.2" rx="1" />
      {/* box */}
      <path d="M4.6 10.6V19a1.6 1.6 0 0 0 1.6 1.6h11.6a1.6 1.6 0 0 0 1.6-1.6v-8.4" />
      {/* ribbon */}
      <path d="M12 6.4v14.2" />
    </svg>
  );
}
