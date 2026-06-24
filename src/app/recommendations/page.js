import AppShell from '@/components/layout/AppShell';
import RequireLogin from '@/components/auth/RequireLogin';
import RecommendationsPage from '@/components/recommendations/RecommendationsPage';

export default function Recommendations() {
  return (
    <AppShell page="recommendations">
      <RequireLogin title="Recommendations Locked" message="Log in to view personalised movie recommendations based on your favourites, ratings and watch status.">
        <RecommendationsPage />
      </RequireLogin>
    </AppShell>
  );
}
