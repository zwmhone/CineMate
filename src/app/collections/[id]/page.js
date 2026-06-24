import AppShell from '@/components/layout/AppShell';
import CollectionDetailPage from '@/components/collections/CollectionDetailPage';

export default async function CollectionDetailRoute({ params, searchParams }) {
  const resolvedParams = await params;
  const query = await searchParams;
  const collectionId = resolvedParams?.id || '';
  const inviteToken = query?.invite || '';

  return (
    <AppShell page="collections">
      <CollectionDetailPage collectionId={collectionId} inviteToken={inviteToken} />
    </AppShell>
  );
}
