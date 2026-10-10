import { CommunityStrip, SplitBand } from '@/components/landing/Sections';
import { CompareExample } from '@/components/landing/CompareExample';
import { DropsBlock } from '@/components/landing/DropsBlock';
import { HeroVideo } from '@/components/landing/HeroVideo';
import { SplitReveal } from '@/components/landing/SplitReveal';
import { SourcesStrip } from '@/components/landing/SourcesStrip';
import { SubscribeBand } from '@/components/landing/SubscribeBand';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';

export const revalidate = 300;

export default function HomePage() {
  return (
    <div className="hide-page-scrollbar isolate min-h-screen overflow-x-clip bg-white text-text [&_footer]:!mt-0 [&_footer]:!bg-[#F6F6F6]">
      <Masthead overlay />
      <main id="main">
        <HeroVideo />
        <SplitReveal index="01" title="Compare.">
          <CompareExample />
        </SplitReveal>
        <SplitReveal index="02" title="Discover.">
          <DropsBlock shoeId="syracuse" />
        </SplitReveal>
        <SplitReveal index="03" title="Connect.">
          <CommunityStrip ids={['onitsuka', 'jordan', 'dunk', 'samba', 'syracuse']} />
        </SplitReveal>
        <SourcesStrip />
        <SplitBand shoeId="samba" />
        <SubscribeBand shoeId="onitsuka" />
      </main>
      <SiteFooter />
    </div>
  );
}
