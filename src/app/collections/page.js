import { redirect } from 'next/navigation';

export default function CollectionsRoute() {
  redirect('/dashboard?tab=collections');
}
