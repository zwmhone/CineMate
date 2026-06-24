import AppShell from '@/components/layout/AppShell';
import RequireLogin from '@/components/auth/RequireLogin';
import ProfilePage from '@/components/profile/ProfilePage';

export default function Profile() {
  return (
    <AppShell page="profile">
      <RequireLogin title="Profile Locked" message="Log in to view and update your CineMate profile.">
        <ProfilePage />
      </RequireLogin>
    </AppShell>
  );
}
