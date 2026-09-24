/** Rust + pulsing dot: the one place "breaking" (urgent) meaning is used on news surfaces. */
export function BreakingPill({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border border-rust/50 bg-rust/10 px-2.5 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-rust ${className}`}
    >
      <span className="live-dot !h-1.5 !w-1.5" aria-hidden />
      Breaking
    </span>
  );
}
