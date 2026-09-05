import { Badge, Card, PriceFigure } from '@chosn/ui';

/**
 * Stays on Vault, same as the hero — this section is still "data,"
 * continuing the terminal read rather than switching surfaces
 * mid-demonstration. Chalk is reserved for the community section
 * right after this one, where the content genuinely is editorial.
 */
export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-moss/20 bg-vault">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-[60ch]">
          <h2 className="font-display text-display-section font-semibold text-text">
            How price intelligence works
          </h2>
          <p className="mt-3 text-body text-text-soft">
            CHOSN checks prices across retailers and resale marketplaces around the clock,
            then tells you if now&apos;s a good time to buy.
          </p>
        </div>

        <Card className="mt-10 max-w-xl p-6 sm:p-8">
          <p className="text-meta uppercase tracking-[0.08em] text-text-faint">
            Nike Dunk Low &quot;Panda&quot; · DD1391-100
          </p>

          <div className="mt-3">
            <PriceFigure value="₹9,499" deltaPct={-6.0} size="hero" />
          </div>

          <div className="mt-4">
            <Badge state="buy">Buy · 6% below its 90-day average</Badge>
          </div>

          <dl className="mt-8 grid grid-cols-1 gap-6 border-t border-moss/20 pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-meta uppercase tracking-[0.06em] text-text-faint">Best</dt>
              <dd className="mt-1">
                <PriceFigure value="₹9,499" />
              </dd>
              <dd className="mt-0.5 text-meta text-text-faint">Flipkart</dd>
            </div>
            <div>
              <dt className="text-meta uppercase tracking-[0.06em] text-text-faint">
                30-day avg
              </dt>
              <dd className="mt-1">
                <PriceFigure value="₹9,810" />
              </dd>
            </div>
            <div>
              <dt className="text-meta uppercase tracking-[0.06em] text-text-faint">
                90-day avg
              </dt>
              <dd className="mt-1">
                <PriceFigure value="₹10,120" />
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </section>
  );
}
