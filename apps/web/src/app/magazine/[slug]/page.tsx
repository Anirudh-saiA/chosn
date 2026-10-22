import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MagazineReader } from '@/components/magazine/MagazineReader';
import { fetchIssue } from '@/lib/magazine';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const issue = await fetchIssue(slug, { next: { revalidate: 300 } });
  return issue ? { title: issue.title, description: issue.coverHeadline ?? undefined } : { title: 'Not found' };
}

export default async function IssuePage({ params }: PageProps) {
  const { slug } = await params;
  const issue = await fetchIssue(slug, { next: { revalidate: 300 } });
  if (!issue) notFound();
  return <MagazineReader issue={issue} />;
}
