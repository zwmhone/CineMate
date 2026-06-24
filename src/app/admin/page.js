import AppShell from '@/components/layout/AppShell';
import RequireLogin from '@/components/auth/RequireLogin';
import AdminPage from '@/components/admin/AdminPage';

export default function Admin() {
  return (
    <AppShell page="admin">
      <RequireLogin title="Admin Locked" message="Log in with an admin account to manage CineMate users and comments.">
        <AdminPage />
      </RequireLogin>
    </AppShell>
  );
}
