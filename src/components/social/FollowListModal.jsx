'use client';

import Link from 'next/link';

function profileInitial(name = '') {
  return String(name || 'CineMate User').trim().charAt(0).toUpperCase() || 'C';
}

function FollowListAvatar({ user }) {
  if (user?.profileImage) {
    return <img src={user.profileImage} alt={`${user.name} profile`} loading="lazy" />;
  }
  return <span>{profileInitial(user?.name)}</span>;
}

export default function FollowListModal({
  open = false,
  type = 'followers',
  users = [],
  loading = false,
  error = '',
  viewerId = '',
  onClose,
  onSwitch,
  onToggleFollow,
  onBlock,
}) {
  if (!open) return null;

  const title = type === 'following' ? 'Following' : 'Followers';
  const emptyText = type === 'following'
    ? 'This user is not following anyone yet.'
    : 'No followers yet.';

  return (
    <div className="social-modal-overlay" role="dialog" aria-modal="true" aria-label={`${title} list`}>
      <div className="social-modal-card">
        <button type="button" className="social-modal-close" aria-label="Close" onClick={onClose}>×</button>
        <p className="eyebrow">CineMate Social</p>
        <h2>{title}</h2>

        <div className="social-modal-tabs" role="tablist" aria-label="Follow lists">
          <button
            type="button"
            className={type === 'followers' ? 'active' : ''}
            onClick={() => onSwitch?.('followers')}
          >
            Followers
          </button>
          <button
            type="button"
            className={type === 'following' ? 'active' : ''}
            onClick={() => onSwitch?.('following')}
          >
            Following
          </button>
        </div>

        {error && <p className="social-modal-error">{error}</p>}
        {loading && <p className="social-modal-empty">Loading users...</p>}
        {!loading && !users.length && <p className="social-modal-empty">{emptyText}</p>}

        {!loading && Boolean(users.length) && (
          <div className="social-user-list">
            {users.map(item => {
              const isSelf = viewerId && item.id === viewerId;
              const followLabel = item.viewerFollows
                ? 'Following'
                : (type === 'followers' ? 'Follow Back' : 'Follow');

              return (
                <article key={item.id} className={`social-user-row${item.viewerBlocked ? ' blocked' : ''}`}>
                  <Link href={`/users/${item.id}`} className="social-user-main" onClick={onClose}>
                    <span className="social-user-avatar"><FollowListAvatar user={item} /></span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.viewerBlocked ? 'Blocked by you' : 'View public profile'}</small>
                    </span>
                  </Link>

                  {!isSelf && (
                    <div className="social-user-actions">
                      <button
                        type="button"
                        className={`social-follow-small${item.viewerFollows ? ' following' : ''}`}
                        disabled={item.viewerBlocked}
                        onClick={() => onToggleFollow?.(item.id, item.viewerFollows)}
                      >
                        {followLabel}
                      </button>
                      <button
                        type="button"
                        className={`social-block-small${item.viewerBlocked ? ' blocked' : ''}`}
                        onClick={() => onBlock?.(item.id)}
                      >
                        {item.viewerBlocked ? 'Unblock' : 'Block'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
