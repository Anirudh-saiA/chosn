import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Badge, Button, Card, Input, PriceFigure } from '@chosn/ui';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { ChartDemo, MotionDemo } from './demos';

export const metadata: Metadata = {
  title: 'Design system',
  description: 'CHOSN "Noir Terminal" living style guide — colour, type, components, surfaces, motion.',
  robots: { index: false },
};

/**
 * Internal visual QA route — the living style guide for the v2 "Noir
 * Terminal" system. Not linked from product nav. Tokens come from
 * packages/config/tailwind-preset.js; swatches below are real classes,
 * so a token change shows up here first.
 */

const SURFACES = [
  { name: 'vault-deep', hex: '#030407', cls: 'bg-vault-deep', use: 'Page floor' },
  { name: 'vault-recessed', hex: '#0A0F0C', cls: 'bg-vault-recessed', use: 'Readouts, wells' },
  { name: 'vault', hex: '#070a12', cls: 'bg-vault', use: 'Base surface' },
  { name: 'vault-raised', hex: '#0c111d', cls: 'bg-vault-raised', use: 'Cards, inputs' },
  { name: 'vault-high', hex: '#131a2a', cls: 'bg-vault-high', use: 'Hover, elevated' },
];
const ACCENTS = [
  { name: 'brass', hex: '#ffa800', cls: 'bg-brass', use: 'Brand · primary CTA' },
  { name: 'brass-bright', hex: '#ffd24d', cls: 'bg-brass-bright', use: 'Highlights, focus' },
  { name: 'signal', hex: '#2ef2a6', cls: 'bg-signal', use: 'Success / positive only' },
  { name: 'rust', hex: '#ff4f6d', cls: 'bg-rust', use: 'Error / negative only' },
  { name: 'moss', hex: '#6B7268', cls: 'bg-moss', use: 'Neutral ramp' },
];
const TEXT = [
  { name: 'text', hex: '#EDEFE7', cls: 'bg-text', use: 'Primary copy' },
  { name: 'text-soft', hex: '#9CA69C', cls: 'bg-text-soft', use: 'Secondary copy' },
  { name: 'text-faint', hex: '#8A948A', cls: 'bg-text-faint', use: 'Meta, hints' },
];
const COLORWAYS: [string, string][] = [
  ['Bred', 'Jordan'],
  ['Panda', 'Nike'],
  ['University Blue', 'Jordan'],
  ['Sail Gum', 'Adidas'],
  ['Olive Green', 'New Balance'],
  ['Royal Purple', 'Nike'],
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-text/10 py-12 first:border-t-0">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-h`} className="mt-2 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-tight tracking-tight text-text">
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Swatches({ items }: { items: typeof SURFACES }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((c) => (
        <li key={c.name} className="border border-text/10 bg-vault">
          <div className={`h-20 border-b border-text/10 ${c.cls}`} />
          <div className="p-3">
            <p className="font-mono text-data-inline font-semibold text-text">{c.name}</p>
            <p className="font-mono text-meta text-text-soft">{c.hex}</p>
            <p className="mt-1 text-meta text-text-faint">{c.use}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const Label = ({ children }: { children: ReactNode }) => (
  <p className="mb-3 font-mono text-meta uppercase tracking-[0.18em] text-text-faint">{children}</p>
);

const NAV = [
  ['color', 'Colour'],
  ['type', 'Type'],
  ['components', 'Components'],
  ['surfaces', 'Surfaces'],
  ['art', 'Sneaker art'],
  ['chart', 'Chart'],
  ['motion', 'Motion'],
];

export default function DesignSystemPage() {
  return (
    <PageShell width="6xl">
      <PageHeader
        eyebrow="Internal — not shipped"
        title={
          <>
            Noir <span className="text-brass-gradient">Terminal</span>
          </>
        }
        description="The CHOSN design system, live. Every swatch, component and surface below is rendered from the real tokens in @chosn/config — nothing is a hardcoded hex."
      />
      <nav aria-label="Sections" className="sticky top-[4.5rem] z-20 -mx-5 mb-4 overflow-x-auto border-y border-text/10 bg-vault-deep/85 px-5 backdrop-blur sm:-mx-8 sm:px-8">
        <ul className="flex gap-1">
          {NAV.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="flex min-h-[44px] items-center px-3 font-mono text-meta uppercase tracking-[0.16em] text-text-soft transition-colors hover:text-brass-bright">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="color" eyebrow="01 · Colour" title="Vault, brass, and two earned signals">
        <div className="space-y-8">
          <div>
            <Label>Surfaces</Label>
            <Swatches items={SURFACES} />
          </div>
          <div>
            <Label>Accents — Brass is the brand. Signal only for success. Rust only for error/negative.</Label>
            <Swatches items={ACCENTS} />
          </div>
          <div>
            <Label>Text ramp</Label>
            <Swatches items={TEXT} />
          </div>
          <div>
            <Label>Gradients</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex h-20 items-end bg-brass-gradient p-3 font-mono text-meta font-semibold text-vault-deep">bg-brass-gradient</div>
              <div className="flex h-20 items-end bg-signal-gradient p-3 font-mono text-meta font-semibold text-vault-deep">bg-signal-gradient</div>
            </div>
          </div>
        </div>
      </Section>

      <Section id="type" eyebrow="02 · Type" title="Three voices">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel p-6">
            <Label>font-display · Fraunces 600–900</Label>
            <p className="font-display text-6xl font-bold leading-none tracking-tight text-text">Aa</p>
            <p className="mt-4 font-display text-2xl font-bold leading-tight text-text">Every pair, at the right price.</p>
            <p className="mt-2 font-display text-lg italic text-text-soft">Italic for asides.</p>
          </div>
          <div className="panel p-6">
            <Label>font-sans · Archivo 400–800</Label>
            <p className="font-sans text-6xl font-extrabold leading-none tracking-tight text-text">Aa</p>
            <p className="mt-4 text-body text-text-soft">UI and body copy. Set at 16px on a 1.65 line height, kept to a comfortable ~68ch measure for reading.</p>
            <p className="mt-2 text-ui-label font-semibold text-text">Label · 13px semibold</p>
          </div>
          <div className="panel p-6">
            <Label>font-mono · JetBrains Mono</Label>
            <p className="font-mono text-6xl font-medium leading-none text-text">Aa</p>
            <p className="mt-4 font-mono text-2xl font-medium text-brass-bright">₹18,750.00</p>
            <p className="mt-2 font-mono text-meta uppercase tracking-[0.18em] text-text-faint">Tabular · codes · dates</p>
          </div>
        </div>
        <div className="panel mt-4 divide-y divide-text/[0.07]">
          {[
            ['display-hero', 'text-display-hero font-display font-bold', 'Hero'],
            ['display-section', 'text-display-section font-display font-bold', 'Section title'],
            ['body', 'text-body', 'Body copy for reading'],
            ['data-hero', 'text-data-hero font-mono font-medium', '₹9,499'],
            ['data-inline', 'text-data-inline font-mono', '₹9,499'],
            ['ui-label', 'text-ui-label font-semibold', 'Label text'],
            ['meta', 'text-meta text-text-soft', 'Meta and captions'],
          ].map(([token, cls, sample]) => (
            <div key={token} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
              <span className="font-mono text-meta text-text-faint">{token}</span>
              <span className={`max-w-full truncate text-text ${cls}`}>{sample}</span>
            </div>
          ))}
        </div>
        <p className="eyebrow mt-6">.eyebrow — mono, brass, tracked</p>
        <p className="text-outline mt-2 font-display text-6xl font-bold leading-none">.text-outline</p>
      </Section>

      <Section id="components" eyebrow="03 · Components" title="@chosn/ui primitives">
        <div className="space-y-8">
          <div>
            <Label>Button · primary / secondary / ghost / disabled</Label>
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary">Compare a price</Button>
              <Button variant="secondary">View listings</Button>
              <Button variant="ghost">Join the community</Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
          </div>
          <div>
            <Label>Badge · buy / wait / neutral</Label>
            <div className="flex flex-wrap gap-3">
              <Badge state="buy">Buy · 6% below average</Badge>
              <Badge state="wait">Wait · near 90-day high</Badge>
              <Badge state="neutral">No signal yet</Badge>
            </div>
          </div>
          <div>
            <Label>Card · vault / chalk</Label>
            <div className="flex flex-wrap gap-4">
              <Card className="w-64 p-5">
                <p className="mb-3 text-ui-label font-semibold text-text">Vault surface</p>
                <PriceFigure value="₹9,499" deltaPct={2.1} />
              </Card>
              <Card surface="chalk" className="w-64 p-5">
                <p className="mb-3 text-ui-label font-semibold text-text-chalk">Chalk surface</p>
                <p className="font-mono text-data-inline font-medium text-text-chalk">₹18,750</p>
              </Card>
            </div>
          </div>
          <div>
            <Label>PriceFigure · hero / inline / trend up / trend down / flat</Label>
            <div className="panel flex flex-wrap items-end gap-x-10 gap-y-5 p-6">
              <PriceFigure value="₹18,750" size="hero" deltaPct={-3.4} />
              <PriceFigure value="₹21,200" size="hero" deltaPct={4.8} />
              <PriceFigure value="₹9,499" />
              <PriceFigure value="₹9,499" deltaPct={0} />
            </div>
            <p className="mt-2 text-meta text-text-faint">Colour follows meaning, not arithmetic: a price fall is signal green, a rise is rust.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Input · default</Label>
              <Input placeholder="you@email.com" aria-label="Sample input" />
            </div>
            <div>
              <Label>Input · error state</Label>
              <Input placeholder="Wrong email" aria-label="Sample input with error" aria-invalid className="!border-rust/70" />
              <p role="note" className="mt-1.5 text-meta text-rust">
                Errors sit under the field, in rust, with aria-describedby.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="surfaces" eyebrow="04 · Surfaces" title="Depth without drop shadows">
        <div className="relative isolate overflow-hidden border border-text/10 bg-vault-deep p-6 sm:p-10">
          <div aria-hidden className="aurora" />
          <div aria-hidden className="grid-lines" />
          <div className="relative z-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['.panel', 'panel p-6', 'Default layered surface'],
              ['.glass', 'glass p-6', 'Blurred, over imagery'],
              ['.panel .ticks', 'panel ticks p-6', 'HUD corner brackets'],
              ['.edge-glow', 'panel edge-glow p-6', 'Gradient hairline on hover'],
            ].map(([name, cls, note]) => (
              <div key={name} tabIndex={0} className={`${cls} min-h-[9rem]`}>
                <p className="font-mono text-data-inline font-semibold text-brass-bright">{name}</p>
                <p className="mt-2 text-meta text-text-soft">{note}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="panel p-6 shadow-glow-brass">
            <p className="font-mono text-meta text-brass-bright">shadow-glow-brass</p>
          </div>
          <div className="panel p-6 shadow-glow-signal">
            <p className="font-mono text-meta text-signal">shadow-glow-signal</p>
          </div>
          <div className="panel p-6 shadow-glow-rust">
            <p className="font-mono text-meta text-rust">shadow-glow-rust</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="panel flex items-center gap-3 p-5">
            <span className="live-dot text-signal" aria-hidden />
            <span className="font-mono text-data-inline text-text">.live-dot</span>
          </div>
          <div className="panel space-y-2 p-5" aria-hidden>
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
            <p className="pt-1 font-mono text-meta text-text-soft">.skeleton</p>
          </div>
          <div className="panel flex items-center p-5">
            <span className="text-brass-gradient font-display text-3xl font-bold">.text-brass-gradient</span>
          </div>
        </div>
      </Section>

      <Section id="art" eyebrow="05 · Sneaker art" title="Designed illustrations, tinted by colourway">
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {COLORWAYS.map(([cw, brand]) => (
            <li key={cw} className="panel ticks p-4">
              <SneakerArt colorway={cw} brand={brand} className="h-auto w-full" />
              <p className="mt-2 text-ui-label font-semibold text-text">{cw}</p>
              <p className="font-mono text-meta text-text-faint">{brand}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="chart" eyebrow="06 · Chart" title="PriceChart">
        <ChartDemo />
      </Section>

      <Section id="motion" eyebrow="07 · Motion" title="One vocabulary, reduced-motion safe">
        <MotionDemo />
      </Section>
    </PageShell>
  );
}
