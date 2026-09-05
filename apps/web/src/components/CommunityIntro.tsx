/**
 * The first real use of Chalk on the live site — Day 2's dual-surface
 * system says data/terminal content stays on Vault and editorial or
 * community content lives on Chalk. This is the first section that's
 * genuinely the latter, so it's the one that switches surfaces.
 *
 * Shell + heading only today, per Day 4 scope — the actual sign-up
 * form and CTA are Day 5's job, not stubbed here as a fake "coming
 * soon" notice.
 */
export function CommunityIntro() {
  return (
    <section id="community" className="bg-chalk">
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-[60ch]">
          <h2 className="font-display text-display-section font-semibold text-text-chalk">
            Join the community
          </h2>
          <p className="mt-3 text-body text-text-chalk-soft">
            Get notified before drops, and see what everyone else is watching.
          </p>
        </div>
      </div>
    </section>
  );
}
