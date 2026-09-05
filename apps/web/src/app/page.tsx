import { Button, Card, PriceFigure } from '@chosn/ui';

/**
 * Day 3 definition of done: a bare page using Button, Card, and
 * PriceFigure with the real Day 2 tokens, not placeholder styling.
 * Tomorrow's landing build replaces this — it isn't the landing page.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-8 px-6">
      <p className="font-mono text-meta uppercase tracking-[0.1em] text-signal">
        Staging build — Day 3
      </p>

      <h1 className="font-display text-display-hero font-bold text-text">
        Every sneaker price,
        <br />
        tracked in real time.
      </h1>

      <Card className="w-full max-w-sm p-6">
        <p className="mb-1 font-mono text-meta uppercase tracking-[0.08em] text-text-faint">
          Nike Dunk Low &quot;Panda&quot;
        </p>
        <PriceFigure value="₹9,499" deltaPct={-6.0} size="hero" />
      </Card>

      <Button variant="primary">Compare a price</Button>
    </main>
  );
}
