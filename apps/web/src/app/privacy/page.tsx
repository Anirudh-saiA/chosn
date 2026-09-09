import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Privacy Policy | CHOSN',
  description: 'What data CHOSN collects, why, how long it is kept, and how to get it deleted.',
};

export const revalidate = 3600;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-display-card font-semibold text-text">{title}</h2>
      <div className="mt-3 flex max-w-[75ch] flex-col gap-3 text-body text-text-soft [&_strong]:text-text [&_a]:text-brass [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </section>
  );
}

function DataRow({ what, why, kept }: { what: string; why: string; kept: string }) {
  return (
    <tr className="border-t border-moss/20 align-top">
      <td className="py-3 pr-4 text-data-inline text-text">{what}</td>
      <td className="py-3 pr-4 text-data-inline text-text-soft">{why}</td>
      <td className="py-3 text-data-inline text-text-soft">{kept}</td>
    </tr>
  );
}

export default function PrivacyPage() {
  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-3xl px-6 py-10 lg:py-14">
        <p className="font-mono text-ui-label uppercase tracking-[0.06em] text-text-faint">Legal</p>
        <h1 className="mt-2 font-display text-display-section font-semibold text-text">Privacy Policy</h1>
        <p className="mt-4 text-meta text-text-faint">Last updated: September 2026</p>

        <div className="mt-6 border-l-2 border-rust pl-4">
          <p className="max-w-[75ch] text-data-inline text-text-soft">
            <strong className="text-text">Pending legal review.</strong> Drafted in-house, not yet
            reviewed by a lawyer qualified on India&apos;s Digital Personal Data Protection Act 2023.
            The DPDP-specific sections below (consent basis, Data Principal rights, grievance
            officer, cross-border transfer) are the ones most likely to need correction before public
            launch — see <code className="font-mono">docs/legal/README.md</code>.
          </p>
        </div>

        <Section title="Who this applies to">
          <p>
            CHOSN is operated from India and primarily serves users in India, so this policy is
            written against the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>.
            If you are in the EU/UK, the rights described below are broadly equivalent to those under
            GDPR, but CHOSN has not yet completed a separate GDPR compliance review.
          </p>
        </Section>

        <Section title="What we collect, why, and for how long">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr>
                  <th className="pb-2 pr-4 font-mono text-meta uppercase tracking-[0.06em] text-text-faint">
                    Data
                  </th>
                  <th className="pb-2 pr-4 font-mono text-meta uppercase tracking-[0.06em] text-text-faint">
                    Why
                  </th>
                  <th className="pb-2 font-mono text-meta uppercase tracking-[0.06em] text-text-faint">
                    Retention
                  </th>
                </tr>
              </thead>
              <tbody>
                <DataRow
                  what="Email address (waitlist)"
                  why="To tell you when access opens"
                  kept="Until you ask us to remove it, or 24 months after launch if you never create an account"
                />
                <DataRow
                  what="Waitlist interests (brands, alert types)"
                  why="To tell you about the things you said you cared about"
                  kept="Same as the waitlist email it belongs to"
                />
                <DataRow
                  what="Account: email, password hash, display name, avatar seed"
                  why="To create and secure your account"
                  kept="Until you delete your account"
                />
                <DataRow
                  what="Two-factor secret (if you enable 2FA)"
                  why="To verify your authenticator codes at login"
                  kept="Until you disable 2FA or delete your account. Encrypted at rest."
                />
                <DataRow
                  what="Google account identifiers (if you sign in with Google)"
                  why="To link your Google sign-in to your CHOSN account"
                  kept="Until you delete your account"
                />
                <DataRow
                  what="Notification subscriptions (brands/models you follow)"
                  why="To send the drop and price alerts you asked for"
                  kept="Until you unsubscribe or delete your account"
                />
                <DataRow
                  what="Web push subscription (browser endpoint and keys)"
                  why="To deliver push notifications to that browser"
                  kept="Until you turn push off, or the browser invalidates it"
                />
                <DataRow
                  what="Reports and blocks you create"
                  why="To operate moderation and keep an audit trail of decisions"
                  kept="Reports are kept as a moderation record; see Community Guidelines"
                />
                <DataRow
                  what="Analytics events (only if you allow analytics)"
                  why="To understand which parts of CHOSN are used"
                  kept="Per PostHog's retention settings; not collected at all unless you consent"
                />
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Legal basis">
          <p>
            Under the DPDP Act, we process your personal data on the basis of your <strong>consent</strong>,
            given when you join the waitlist, create an account, subscribe to notifications, or accept
            analytics. For account security data (password hashes, 2FA secrets, session records) we
            also rely on the legitimate use of delivering the service you signed up for.
          </p>
          <p>
            You can withdraw consent at any time — by unsubscribing, declining analytics, or deleting
            your account.
          </p>
        </Section>

        <Section title="Who we share data with">
          <p>These are the actual third parties in use today, not a generic list:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Vercel</strong> — hosts the CHOSN website. Receives standard request data (IP
              address, user agent) as part of serving pages.
            </li>
            <li>
              <strong>Railway</strong> — hosts the CHOSN API and the PostgreSQL database where all
              account, waitlist, and notification data is stored.
            </li>
            <li>
              <strong>Google (Sign in with Google)</strong> — if you choose Google sign-in, Google
              provides us your email, name, and profile image. Authentication is handled by Auth.js
              (NextAuth); we never see your Google password.
            </li>
            <li>
              <strong>PostHog (US Cloud)</strong> — product analytics. Only receives anything if you
              explicitly allow analytics in the consent banner. Declining means PostHog is never
              loaded.
            </li>
            <li>
              <strong>Resend</strong> — sends transactional email (waitlist confirmation, password
              reset). Receives your email address and the message content.
            </li>
            <li>
              <strong>Sentry</strong> — server-side error monitoring for the CHOSN API. Receives error
              traces, which may incidentally include technical request details. Browser-side Sentry was
              deliberately removed and is not in use.
            </li>
            <li>
              <strong>Google Perspective API</strong> — automated toxicity screening for user-submitted
              text, once community features ship. Receives the text being screened, not your identity.
            </li>
            <li>
              <strong>Your browser&apos;s push service</strong> (Google FCM, Mozilla, or Apple, depending
              on your browser) — required to deliver web push notifications if you enable them.
            </li>
          </ul>
          <p>
            <strong>We do not sell your personal data</strong>, and we do not share it with retailers
            or advertisers. When you click a &quot;View Deal&quot; link, the retailer may see standard
            referral information (that you arrived from CHOSN) — but we do not send them your account
            details.
          </p>
          <p>
            Some of these providers store data outside India. The DPDP Act permits cross-border
            transfer except to countries specifically restricted by the Government of India.
          </p>
        </Section>

        <Section title="Cookies and similar technologies">
          <p>
            <strong>Essential:</strong> your login session cookie (set by Auth.js), and local storage
            used to remember your notification subscriber ID and your analytics consent choice. These
            are required for the site to work and are not optional.
          </p>
          <p>
            <strong>Non-essential:</strong> PostHog analytics cookies and local storage. These are{' '}
            <strong>off by default</strong> and are only set if you choose &quot;Allow analytics&quot;.
            Declining, or simply ignoring the banner, means PostHog is never loaded and sets nothing.
          </p>
          <p>CHOSN runs no advertising or retargeting pixels of any kind.</p>
        </Section>

        <Section title="Your rights">
          <p>Under the DPDP Act you have the right to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Access</strong> — ask what personal data we hold about you.
            </li>
            <li>
              <strong>Correction</strong> — have inaccurate data corrected. Your display name and
              avatar are editable directly in{' '}
              <Link href="/account/security">account settings</Link>.
            </li>
            <li>
              <strong>Erasure</strong> — have your data deleted. You can do this yourself, immediately,
              from <Link href="/account/security">account settings</Link>; it removes your account,
              subscriptions, push registrations, and blocks. You can also email us and we will do it
              within 30 days.
            </li>
            <li>
              <strong>Grievance redressal</strong> — raise a complaint about how we handle your data
              (see below), and escalate to the Data Protection Board of India if unsatisfied.
            </li>
            <li>
              <strong>Nominate</strong> — nominate another person to exercise these rights on your
              behalf in the event of death or incapacity. Email us to do this.
            </li>
          </ul>
        </Section>

        <Section title="Children">
          <p>
            CHOSN is not intended for anyone under 13, and we do not knowingly collect data from
            children under 13. Under the DPDP Act, processing a child&apos;s data requires verifiable
            parental consent; CHOSN does not currently offer accounts to under-13s for that reason. If
            you believe a child has created an account, email us and we will delete it.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Passwords are hashed with bcrypt and never stored in plain text. Two-factor secrets are
            encrypted at rest. Sessions use signed, httpOnly, secure cookies. Login, signup, and
            password-reset endpoints are rate-limited against credential-stuffing.
          </p>
        </Section>

        <Section title="Grievance officer">
          <p>
            The DPDP Act requires a named contact for data complaints. For now this is the founder,
            reachable at <a href="mailto:privacy@chosn.app">privacy@chosn.app</a>. We aim to respond
            within 7 days and resolve within 30.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We&apos;ll date any material change here and notify registered users by email where the
            change meaningfully affects them.
          </p>
        </Section>
      </div>
      <SiteFooter />
    </main>
  );
}
