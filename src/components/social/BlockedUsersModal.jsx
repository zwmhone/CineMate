'use client';

import Link from 'next/link';

function profileInitial(name = '') {
  return String(name || 'CineMate User').trim().charAt(0).toUpperCase() || 'C';
}

function BlockedAvatar({ user }) {
  if (user?.profileImage) {
    return <img src={user.profileImage} alt={`${user.name} profile`} loading="lazy" />;
  }
  return <span>{profileInitial(user?.name)}</span>;
}

export default function BlockedUsersModal({
  open = false,
  users = [],
  loading = false,
  error = '',
  onClose,
  onUnblock,
}) {
  if (!open) return null;

  return (
    <div className="social-modal-overlay" role="dialog" aria-modal="true" aria-label="Blocked users list">
      <div className="social-modal-card blocked-users-modal-card">
        <button type="button" className="social-modal-close" aria-label="Close" onClick={onClose}>×</button>
        <p className="eyebrow">Privacy controls</p>
        <h2>Blocked Users</h2>
        <p className="blocked-users-help">
          Manage users you have blocked. Unblocking allows you to follow or interact with them again.
        </p>

        {error && <p className="social-modal-error">{error}</p>}
        {loading && <p className="social-modal-empty">Loading blocked users...</p>}
        {!loading && !users.length && <p className="social-modal-empty">You have not blocked anyone.</p>}

        {!loading && Boolean(users.length) && (
          <div className="social-user-list">
            {users.map(item => (
              <article key={item.id} className="social-user-row blocked">
                <Link href={`/users/${item.id}`} className="social-user-main" onClick={onClose}>
                  <span className="social-user-avatar"><BlockedAvatar user={item} /></span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>Blocked by you</small>
                  </span>
                </Link>

                <div className="social-user-actions">
                  <button
                    type="button"
                    className="social-block-small blocked"
                    onClick={() => onUnblock?.(item.id)}
                  >
                    Unblock
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
