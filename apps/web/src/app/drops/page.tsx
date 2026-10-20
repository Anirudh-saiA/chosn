import { redirect } from 'next/navigation';

/** Drops and News now live together on the Releases page. Individual drops (/drops/[id]) still have their own pages. */
export default function DropsPage() {
  redirect('/releases?tab=drops');
}
