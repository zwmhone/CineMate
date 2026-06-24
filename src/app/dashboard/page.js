import AppShell from '@/components/layout/AppShell';
import RequireLogin from '@/components/auth/RequireLogin';
import DashboardPage from '@/components/dashboard/DashboardPage';

export default function Dashboard() {
  return (
    <AppShell page="dashboard">
      <RequireLogin title="Dashboard Locked" message="Log in to view your saved movies, ratings, watch status and activity dashboard.">
        <DashboardPage />
      </RequireLogin>
    </AppShell>
  );
}
