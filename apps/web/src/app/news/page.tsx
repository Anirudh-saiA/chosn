import { redirect } from 'next/navigation';

/** Drops and News now live together on the Releases page. Individual stories (/news/[id]) still have their own pages. */
export default function NewsPage() {
  redirect('/releases?tab=news');
}
