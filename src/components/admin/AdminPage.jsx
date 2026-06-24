'use client';

import { useMemo, useState } from 'react';
import AdminStats from './AdminStats';
import CommentModeration from './CommentModeration';
import MovieManagement from './MovieManagement';
import UserManagement from './UserManagement';
import useAdmin from '@/hooks/useAdmin';
import { useAuth } from '@/lib/AuthContext';

const VIEW_LABELS = {
  users: 'Registered Users',
  banned: 'Banned Users',
  ratings: 'Ratings Overview',
  comments: 'Visible Comments',
  hidden: 'Hidden Comments',
  reports: 'Open Reports',
  favourites: 'Favourite Records',
};

export default function AdminPage() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState('users');
  const {
    isAdmin,
    overview,
    users,
    comments,
    movies,
    loading,
    saving,
    error,
    refreshAdmin,
    setUserBan,
    issueWarning,
    removeWarning,
    hideComment,
    unhideComment,
    dismissReports,
    deleteComment,
  } = useAdmin();

  const commentFilter = useMemo(() => {
    if (activeView === 'reports') return 'reported';
    if (activeView === 'hidden') return 'hidden';
    if (activeView === 'comments') return 'all';
    return 'reported';
  }, [activeView]);

  if (loading) {
    return (
      <main className="cm-admin-page">
        <section className="cm-admin-locked-panel">
          <p className="cm-admin-eyebrow">Admin Dashboard</p>
          <h2>Loading admin tools...</h2>
          <p className="cm-admin-meta">Checking your role and moderation data.</p>
        </section>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="cm-admin-page">
        <section className="cm-admin-locked-panel">
          <p className="cm-admin-eyebrow">Admin Dashboard</p>
          <h2>Admin access required</h2>
          <p className="cm-admin-meta">This page is only available to CineMate admin users. Run the admin SQL setup and promote your account before opening this page.</p>
          {error && <p className="cm-admin-error-box">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="cm-admin-page">
      <section className="cm-admin-hero">
        <div>
          <p className="cm-admin-eyebrow">Admin Control Centre</p>
          <h2 className="cm-admin-gradient-title">CineMate Admin</h2>
          <p className="cm-admin-meta">Manage users, review reports, hide harmful comments and monitor platform activity.</p>
        </div>
        <button type="button" className="cm-admin-refresh-btn" disabled={saving} onClick={refreshAdmin}>Refresh</button>
      </section>

      {error && <p className="cm-admin-error-box">{error}</p>}

      <AdminStats overview={overview} activeView={activeView} onSelect={setActiveView} />

      <section className="cm-admin-info-strip">
        <strong>{VIEW_LABELS[activeView] || 'Admin Details'}</strong>
        <span>
          Hidden comments are removed from public movie detail pages. Open reports are user-submitted reports waiting for an admin decision. Ratings and favourites are view-only summaries.
        </span>
      </section>

      {['users', 'banned'].includes(activeView) && (
        <UserManagement
          users={users}
          saving={saving}
          currentUserId={user?.id}
          mode={activeView}
          onSetBan={setUserBan}
          onRemoveWarning={removeWarning}
          onIssueWarning={issueWarning}
        />
      )}

      {['comments', 'hidden', 'reports'].includes(activeView) && (
        <CommentModeration
          comments={comments}
          saving={saving}
          initialFilter={commentFilter}
          onHide={hideComment}
          onUnhide={unhideComment}
          onDismiss={dismissReports}
          onDelete={deleteComment}
          onIssueWarning={issueWarning}
        />
      )}

      {['ratings', 'favourites'].includes(activeView) && (
        <MovieManagement
          movies={movies}
          mode={activeView}
        />
      )}
    </main>
  );
}
