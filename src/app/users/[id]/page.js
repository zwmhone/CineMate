import AppShell from '@/components/layout/AppShell';
import PublicProfilePage from '@/components/social/PublicProfilePage';

export default async function PublicUserRoute({ params }) {
  const resolvedParams = await params;
  const userId = resolvedParams?.id || '';

  return (
    <AppShell page="users">
      <PublicProfilePage profileUserId={userId} />
    </AppShell>
  );
}
