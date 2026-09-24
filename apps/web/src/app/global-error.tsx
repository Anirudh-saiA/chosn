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
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
    background:radial-gradient(60vmax 40vmax at 85% -10%,rgba(255,168,0,.22),transparent 60%),
      radial-gradient(50vmax 40vmax at 0% 110%,rgba(255,79,109,.16),transparent 60%),#030407;
    color:#EDEFE7;font-family:'Archivo',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
  .card{position:relative;width:100%;max-width:34rem;padding:40px 32px;text-align:left;
    background:linear-gradient(180deg,rgba(12,17,29,.95),rgba(7,10,18,.95));
    border:1px solid rgba(230,232,236,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 30px 80px -30px rgba(0,0,0,.8)}
  .card::before,.card::after{content:'';position:absolute;width:14px;height:14px;border:0 solid #ffa800}
  .card::before{top:-1px;left:-1px;border-top-width:1px;border-left-width:1px}
  .card::after{right:-1px;bottom:-1px;border-right-width:1px;border-bottom-width:1px}
  .eyebrow{margin:0;font:500 11px/1 ui-monospace,'JetBrains Mono',Menlo,monospace;letter-spacing:.22em;text-transform:uppercase;color:#ff4f6d}
  h1{margin:16px 0 0;font:900 clamp(2rem,6vw,2.75rem)/1.02 Georgia,'Fraunces',serif;letter-spacing:-.02em}
  p{margin:16px 0 0;color:#9CA69C;line-height:1.65;font-size:1rem}
  code{font-family:ui-monospace,'JetBrains Mono',Menlo,monospace;color:#EDEFE7;background:rgba(230,232,236,.06);padding:2px 6px}
  .row{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
  .btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;font:600 13px/1 inherit;font-family:inherit;
    text-decoration:none;cursor:pointer;border:1px solid rgba(230,232,236,.15);background:rgba(12,17,29,.7);color:#EDEFE7;transition:border-color .2s,background .2s}
  .btn:hover{border-color:rgba(255,168,0,.6);background:#131a2a}
  .btn.primary{border-color:rgba(255,210,77,.4);background:linear-gradient(135deg,#ffd24d,#ffa800 55%,#e07a00);color:#030407}
  .btn:focus-visible{outline:2px solid #ffd24d;outline-offset:3px}
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
