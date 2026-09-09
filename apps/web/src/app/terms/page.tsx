import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { AFFILIATE_DISCLOSURE_LONG, NOT_A_MARKETPLACE } from '@/lib/legal-copy';

export const metadata: Metadata = {
  title: 'Terms of Service | CHOSN',
  description: "The terms governing use of CHOSN's price-comparison service.",
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

export default function TermsPage() {
  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-3xl px-6 py-10 lg:py-14">
        <p className="font-mono text-ui-label uppercase tracking-[0.06em] text-text-faint">Legal</p>
        <h1 className="mt-2 font-display text-display-section font-semibold text-text">Terms of Service</h1>
        <p className="mt-4 text-meta text-text-faint">Last updated: September 2026</p>

        <div className="mt-6 border-l-2 border-rust pl-4">
          <p className="max-w-[75ch] text-data-inline text-text-soft">
            <strong className="text-text">Pending legal review.</strong> This document was drafted
            in-house and has not yet been reviewed by a qualified lawyer. It must not be relied on as
            final before public launch — particularly the liability, jurisdiction, and DPDP Act
            sections. See <code className="font-mono">docs/legal/README.md</code> in the repository
            for the review checklist.
          </p>
        </div>

        <Section title="1. What CHOSN is">
          <p>{NOT_A_MARKETPLACE}</p>
          <p>
            CHOSN collects price information from third-party retailers and resale marketplaces and
            presents it so you can compare. When you click <strong>View Deal</strong>, you leave CHOSN
            and transact entirely with that third party, under their terms, not ours.
          </p>
        </Section>

        <Section title="2. CHOSN is not a party to your transaction">
          <p>
            <strong>
              CHOSN is not a party to any transaction between you and any retailer or reseller.
            </strong>{' '}
            We do not sell the goods, take payment, hold funds, ship anything, or handle returns. Any
            contract of sale is between you and the retailer.
          </p>
          <p>
            This means questions about delivery, refunds, exchanges, sizing, warranty, or authenticity
            are between you and that retailer. CHOSN cannot resolve them and has no authority to.
          </p>
        </Section>

        <Section title="3. Price accuracy">
          <p>
            <strong>CHOSN does not guarantee price accuracy at the point of purchase.</strong> Every
            price shown is sourced from a third party at the time we last checked it, and each price is
            displayed with the retailer it came from and how recently it was fetched.
          </p>
          <p>
            Prices, stock levels, shipping costs, and availability are set by the retailer and can
            change at any time, including between the moment you load a CHOSN page and the moment you
            reach the retailer&apos;s site. The price at checkout is the real price. Treat CHOSN&apos;s
            figures as a research aid, not an offer.
          </p>
          <p>
            The same applies to our market-intelligence signals (&quot;good time to buy&quot;, 30- and
            90-day averages, trend percentages). These are calculated from historical data we have
            collected, and are informational — not financial advice or a prediction.
          </p>
        </Section>

        <Section title="4. Affiliate links">
          <p>{AFFILIATE_DISCLOSURE_LONG}</p>
          <p>
            Commission never changes the ranking of offers. Offers are ordered by price, not by what we
            earn.
          </p>
        </Section>

        <Section title="5. Your account">
          <p>
            You must be at least 13 years old to create a CHOSN account. If you are under 18, you may
            only use CHOSN with the involvement of a parent or guardian.
          </p>
          <p>
            You are responsible for keeping your password and any two-factor authentication method
            secure, and for activity that happens under your account.
          </p>
          <p>
            You may delete your account at any time from{' '}
            <Link href="/account/security">your account settings</Link>. Deletion is permanent.
          </p>
        </Section>

        <Section title="6. Community guidelines">
          <p>
            Our <Link href="/community-guidelines">Community Guidelines</Link> are incorporated into
            these Terms by reference and apply to all user-generated content on CHOSN — today that
            means your display name, avatar, and anything you submit through a form, including reports;
            in future it will also cover posts, comments, and direct messages.
          </p>
          <p>
            Breaching the Community Guidelines is a breach of these Terms, and may result in content
            removal, restrictions, or termination of your account as described there.
          </p>
        </Section>

        <Section title="7. Acceptable use">
          <p>
            Don&apos;t scrape, bulk-download, or resell CHOSN&apos;s price data; don&apos;t attempt to
            disrupt or gain unauthorised access to the service; don&apos;t use CHOSN to break the law.
          </p>
        </Section>

        <Section title="8. Service availability">
          <p>
            CHOSN is provided as-is. We don&apos;t guarantee uninterrupted availability, and features
            may change or be withdrawn. This is an early-stage product.
          </p>
        </Section>

        <Section title="9. Changes to these Terms">
          <p>
            We may update these Terms. Material changes will be dated here, and where changes
            meaningfully affect your rights we will notify registered users by email.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions about these Terms, or anything else:{' '}
            <a href="mailto:hello@chosn.app">hello@chosn.app</a>.
          </p>
        </Section>
      </div>
      <SiteFooter />
    </main>
  );
}
