import Link from 'next/link';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { fetchIssues, type IssueSummary } from '@/lib/magazine';

export const revalidate = 300;

const SERIF = { fontFamily: 'var(--font-mag-serif), Georgia, serif', textTransform: 'none' } as const;

function when(i: IssueSummary): string {
  const d = new Date(`${i.periodStart}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { weekday: i.kind === 'daily' ? 'long' : undefined, day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function Cover({ i, label }: { i: IssueSummary; label: string }) {
  return (
    <Link href={`/magazine/${i.slug}`} className="group relative block aspect-[3/4] overflow-hidden rounded-2xl bg-[#C8102E] shadow-[0_30px_60px_-30px_rgba(10,10,10,0.6)] transition-transform duration-300 hover:-translate-y-1">
      {i.coverImage ? (
        <img src={i.coverImage} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-[#5a0716]/80 via-transparent to-[#5a0716]/90" />
      <div className="absolute inset-0 flex flex-col justify-between p-5 text-white">
        <div>
          <p className="border-b-2 border-white pb-1 font-mono text-[0.62rem] uppercase tracking-[0.2em]">
            {label} · No. {i.issueNo}
          </p>
          <p style={SERIF} className="mt-2 text-[2.6rem] font-black leading-[0.92] tracking-tight">
            The CHOSN Times
          </p>
        </div>
        <div>
          <span className="rounded-full bg-white px-3 py-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#0A0A0A]">Read the issue</span>
          <p style={SERIF} className="mt-3 text-xl font-black leading-tight">
            {i.coverHeadline}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default async function MagazineIndex() {
  const [daily, weekly] = await Promise.all([fetchIssues('daily', { next: { revalidate: 300 } }), fetchIssues('weekly', { next: { revalidate: 300 } })]);
  const latestDaily = daily[0];
  // One issue a day: the daily. On Sunday there are two: the weekly edition (it covers the week that ends that Sunday) sits beside it.
  const todayIst = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const latestWeekly = weekly.find((w) => w.periodEnd === todayIst);
  const archive = [...daily.slice(1), ...weekly.filter((w) => w !== latestWeekly)].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (
    <div className="page-shell relative">
      <div className="relative z-10">
        <Masthead />
        <main id="main" className="mx-auto w-full max-w-[80rem] px-5 pb-16 pt-6 sm:px-8">
          <header className="border-y-[3px] border-double border-[#0A0A0A] py-6 text-center">
            <h1 style={SERIF} className="text-[clamp(2.6rem,8vw,5.5rem)] font-black leading-none tracking-tight text-[#0A0A0A]">
              The CHOSN Times
            </h1>
            <p className="mt-3 border-t border-[#0A0A0A]/25 pt-3 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-[#0A0A0A]/60">
              Sneaker news and drops, in pages you can turn · a daily and a weekly edition
            </p>
          </header>
          {!latestDaily && !latestWeekly ? (
            <p className="mt-10 text-center text-[#0A0A0A]/60">The first issue is being printed. Check back soon.</p>
          ) : (
            <section className={`mx-auto mt-10 grid gap-8 ${latestDaily && latestWeekly ? 'max-w-3xl sm:grid-cols-2' : 'max-w-sm'}`}>
              {latestDaily ? (
                <div>
                  <Cover i={latestDaily} label="Daily" />
                  <p className="mt-3 text-center font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[#0A0A0A]/60">{when(latestDaily)}</p>
                </div>
              ) : null}
              {latestWeekly ? (
                <div>
                  <Cover i={latestWeekly} label="Weekly" />
                  <p className="mt-3 text-center font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[#0A0A0A]/60">Week of {when(latestWeekly)}</p>
                </div>
              ) : null}
            </section>
          )}
          {archive.length > 0 && (
            <section className="mx-auto mt-14 max-w-3xl" aria-label="Earlier issues">
              <h2 className="mb-3 border-b-2 border-[#0A0A0A] pb-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]">Earlier issues</h2>
              <ul className="divide-y divide-[#0A0A0A]/15">
                {archive.map((i) => (
                  <li key={i.slug}>
                    <Link href={`/magazine/${i.slug}`} className="flex items-baseline justify-between gap-4 py-3 hover:underline">
                      <span style={SERIF} className="text-lg font-bold">
                        {i.kind === 'daily' ? 'Daily' : 'Weekly'} No. {i.issueNo}: {i.coverHeadline}
                      </span>
                      <span className="shrink-0 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-[#0A0A0A]/55">{when(i)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
