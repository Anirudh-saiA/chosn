import { CommunityIntro } from '@/components/CommunityIntro';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { Masthead } from '@/components/Masthead';

export default function HomePage() {
  return (
    <main>
      <Masthead />
      <Hero />
      <HowItWorks />
      <CommunityIntro />
    </main>
  );
}
