import { WaitlistForm } from './WaitlistForm';

/**
 * Day 2's dual-surface system says data/terminal content stays on
 * Vault and editorial or community content lives on Chalk — this is
 * the section that switches.
 *
 * Copy is deliberately scoped to what exists today: an early-access
 * list and price/drop notifications. CHOSN has no live chat, forums,
 * or social feed yet, so nothing here implies one — see the Day 1
 * spec's "not a marketplace" boundary; the same discipline applies to
 * not overselling community features that aren't built.
 */
export function CommunityIntro() {
  return (
    <section id="community" className="bg-chalk">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="max-w-[60ch]">
            <h2 className="font-display text-display-section font-semibold text-text-chalk">
              Get early access
            </h2>
            <p className="mt-3 text-body text-text-chalk-soft">
              CHOSN is opening in waves. Join the list and we'll email you when your
              access opens — plus, if you want, a heads-up on drops and price moves
              for the sneakers you care about.
            </p>
          </div>

          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
