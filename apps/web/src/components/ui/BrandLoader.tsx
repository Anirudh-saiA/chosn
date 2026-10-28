/**
 * The one loading screen for the whole site: a full-screen backdrop with the
 * CHOSN wordmark stacked solid / outlined inside a circle, a thin arc
 * circling it, and a caption. Server-renderable (pure CSS animation, which
 * the global reduced-motion rule already freezes).
 */
export function BrandLoader({ label = 'Curating your edit…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-10 bg-white"
      
    >
      <div className="relative flex h-[17rem] w-[17rem] items-center justify-center rounded-full border border-text/10 bg-white sm:h-[19rem] sm:w-[19rem]">
        <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-spin [animation-duration:2.4s]">
          <circle cx="50" cy="50" r="49" fill="none" stroke="#0A0A0A" strokeWidth="0.6" strokeLinecap="round" strokeDasharray="46 262" />
        </svg>
        <span
          aria-hidden
          className="logo-mask w-[58%] animate-pulse text-text [animation-duration:2s]"
          style={{ ['--m' as string]: 'url(/images/logo-full.png)', aspectRatio: 1.219 }}
        />
      </div>
      <p className="font-sans text-lg font-medium tracking-wide text-text-soft">{label}</p>
    </div>
  );
}
