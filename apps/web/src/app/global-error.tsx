'use client';

/**
 * Replaces the root layout when it throws, so globals.css / Tailwind /
 * next-font are NOT guaranteed to be loaded. Everything here is inline
 * (a <style> block + system font fallbacks) and mirrors the Noir
 * Terminal tokens by hand.
 */
const CSS = `
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#fff;color:#0a0a0a;
    font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
  .card{width:100%;max-width:34rem;padding:40px 32px;text-align:left;background:#fff;border:1px solid #e5e5e5;border-radius:28px;box-shadow:0 18px 40px -28px rgba(0,0,0,.3)}
  .eyebrow{margin:0;font:600 11px/1 Inter,system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#9a5a00}
  h1{margin:16px 0 0;font:700 clamp(1.75rem,6vw,2.5rem)/1.08 Inter,system-ui,sans-serif;letter-spacing:-.025em}
  p{margin:16px 0 0;color:#404040;line-height:1.65;font-size:1rem}
  code{font-family:ui-monospace,Menlo,monospace;color:#0a0a0a;background:#f0f0f0;padding:2px 8px;border-radius:8px}
  .row{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
  .btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;font:600 14px/1 Inter,system-ui,sans-serif;
    text-decoration:none;cursor:pointer;border:1px solid #0a0a0a;border-radius:999px;background:#fff;color:#0a0a0a;transition:background .2s,color .2s}
  .btn:hover{background:#f0f0f0}
  .btn.primary{background:#0a0a0a;color:#fff}
  .btn.primary:hover{background:#262626}
  .btn:focus-visible{outline:2px solid #0a0a0a;outline-offset:3px}
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset?: () => void }) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong | CHOSN</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main className="card" role="alert">
          <p className="eyebrow" style={{ marginTop: 0 }}>
            Error · Unexpected
          </p>
          <h1>Something went wrong.</h1>
          <p>
            That one&apos;s on us. The page failed to load — try again, and if it keeps happening, head back home.
            {error.digest ? (
              <>
                {' '}
                Reference: <code>{error.digest}</code>
              </>
            ) : null}
          </p>
          <div className="row">
            {reset && (
              <button type="button" className="btn primary" onClick={() => reset()}>
                Try again
              </button>
            )}
            <a className="btn" href="/">
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
