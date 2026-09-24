import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalLayout, LegalSection } from '@/components/legal/Legal';

export const metadata: Metadata = {
  title: 'Community Guidelines',
  description: "CHOSN's rules for how members treat each other, and what happens when they're broken.",
};

// Static — no per-visitor data, safe to prerender/ISR like the rest of
// this app's content pages (drops, news). A long revalidate rather than
// fully static: this document should be editable without a full
// redeploy mattering for freshness, but it isn't going to change hour
// to hour either.
export const revalidate = 3600;

export default function CommunityGuidelinesPage() {
  return (
    <LegalLayout
      eyebrow="Trust &amp; safety"
      title="Community Guidelines"
      lede={
        <>
          These apply to every member of CHOSN — today's price-comparison and notification features, and
          every community feature built on top of them later. They're written now, before chat and posts
          ship, because a safety policy adopted after the first incident always reads like an apology. This
          one doesn't.
        </>
      }
    >
        <LegalSection id="who-this-covers" title="Who this covers">
          <p>
            Anyone who creates a CHOSN account. It applies to your display name, your avatar, anything you
            submit through a form on this site (including reports themselves), and — once they exist —
            posts, comments, and direct messages.
          </p>
        </LegalSection>

        <LegalSection id="harassment" title="Harassment">
          <p>
            <strong>Not allowed:</strong> targeted insults, threats, sustained unwanted contact after
            someone has asked you to stop or has blocked you, coordinating with others to pile onto one
            person, or using CHOSN's block/report tools in bad faith to harass someone yourself.
          </p>
          <p>
            A single heated disagreement about a price, a drop, or a release isn't harassment. A pattern
            aimed at one person, or one severe incident (a threat, for example), is.
          </p>
        </LegalSection>

        <LegalSection id="hate-speech" title="Hate speech">
          <p>
            <strong>Not allowed:</strong> attacks, slurs, or dehumanizing language directed at someone
            because of race, ethnicity, national origin, caste, religion, gender, gender identity, sexual
            orientation, disability, or serious illness. This applies to display names and avatars too, not
            just posts and messages.
          </p>
        </LegalSection>

        <LegalSection id="doxxing" title="Doxxing and deanonymization">
          <p>
            <strong>Not allowed:</strong> sharing another member's real name, address, phone number, email,
            workplace, or other identifying information without their consent — including piecing it
            together from what they've posted and presenting the conclusion publicly. This includes trying
            to identify who is behind a display name.
          </p>
          <p>
            This matters in a specific way for CHOSN: what someone collects, watches for, or can afford
            signals real information about their income and, sometimes, their location. Treat a member's
            collection and price-tracking activity as information about a real person with real physical
            safety at stake, not just data about a hobby.
          </p>
        </LegalSection>

        <LegalSection id="scam-legit-check-abuse" title="Scam and legit-check abuse">
          <p>
            <strong>Not allowed:</strong> using CHOSN to advertise counterfeit goods as authentic, running
            payment scams under cover of a "legit check" or authentication request, or falsely accusing a
            specific seller of running a scam as a way to harass them or damage their reputation without
            evidence.
          </p>
          <p>
            CHOSN compares prices and routes you to retailers and resellers via <strong>View Deal</strong> —
            it never holds funds, verifies authenticity, or acts as an escrow. Anyone claiming otherwise on
            this platform, in a display name, or in messages, is violating these guidelines regardless of
            whether real money changed hands.
          </p>
        </LegalSection>

        <LegalSection id="spam" title="Spam and platform manipulation">
          <p>
            <strong>Not allowed:</strong> repetitive unsolicited messages to people who haven't engaged with
            you, fake reports filed to harass someone through the moderation system itself, or automated
            account creation.
          </p>
        </LegalSection>

        <LegalSection id="reporting" title="Reporting something">
          <p>
            Every reportable thing on CHOSN — starting with accounts today, and posts, comments, and
            messages as those ship — can be reported directly from where it appears. A report goes to a
            queue a real person reviews; filing one does not notify or take any action against the person
            you're reporting on its own.
          </p>
          <p>Tell us what happened and why — a specific report is a faster, more accurate one.</p>
        </LegalSection>

        <LegalSection id="blocking" title="Blocking">
          <p>
            Blocking someone is unilateral and immediate — you don't need a reason, and the person you block
            isn't told. Once blocked, that member's contact with you (direct messages, mentions, and
            visibility of each other's content, as those features ship) stops in both directions. See our{' '}
            <Link href="/transparency">transparency page</Link> for how CHOSN reports on enforcement without
            exposing individual cases.
          </p>
        </LegalSection>

        <LegalSection id="enforcement" title="Enforcement">
          <p>
            A report is reviewed by a real person against these guidelines, not resolved automatically.
            Outcomes range from no action (the report is dismissed, with the reasoning kept in our internal
            review notes) to a formal warning, temporary restrictions, or account termination for severe or
            repeated violations — doxxing, credible threats, and scam operations are treated as severe from
            the first confirmed incident, not after a pattern.
          </p>
          <p>
            We don't publish individual moderation decisions or discuss another member's account with you.
            We do publish aggregate enforcement numbers — see the{' '}
            <Link href="/transparency">transparency page</Link>.
          </p>
        </LegalSection>

        <LegalSection id="changes" title="Changes to these guidelines">
          <p>
            These guidelines will be revised as CHOSN's community features expand — the principles above are
            meant to hold regardless of what specific feature they're applied to. Material changes will be
            dated here.
          </p>
          <p className="text-meta text-text-faint">Last substantive revision: September 2026.</p>
        </LegalSection>
    </LegalLayout>
  );
}
