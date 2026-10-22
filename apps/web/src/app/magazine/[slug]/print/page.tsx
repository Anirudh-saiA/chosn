import { notFound } from 'next/navigation';
import { MagazinePage } from '@/components/magazine/Pages';
import { fetchIssue } from '@/lib/magazine';

export const metadata = { title: 'The CHOSN Times (print)', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Every page of an issue on its own 600 x 800 sheet, for scripts/render_magazine_pdf.py to turn into a PDF. No site chrome. */
export default async function PrintPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const issue = await fetchIssue(slug, { cache: 'no-store' });
  if (!issue) notFound();
  return (
    <div className="mag-print">
      <style>{`
        @page { size: 600px 800px; margin: 0; }
        /* The site's film grain and aurora backgrounds would be rasterised onto every page and bloat the PDF to 25 MB. */
        html, body, body::before, body::after, html::before, html::after, .grain::after { margin: 0; background: #fff !important; background-image: none !important; filter: none !important; }
        .grain::after { display: none !important; }
        .mag-print .sheet { width: 600px; height: 800px; break-after: page; page-break-after: always; overflow: hidden; position: relative; }
        .mag-print .sheet:last-child { break-after: auto; page-break-after: auto; }
      `}</style>
      {issue.pages.map((p, i) => (
        <div key={i} className="sheet">
          <MagazinePage page={p} n={i + 1} slug={issue.slug} />
        </div>
      ))}
    </div>
  );
}
