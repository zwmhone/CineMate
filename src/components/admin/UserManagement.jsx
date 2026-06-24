'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalScrollLock from '@/hooks/useModalScrollLock';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch {
    return '—';
  }
}



function parseBanReason(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return { raw: '', items: [], isList: false };

  const listLike = /(?:\r?\n|^\s*[-•*]\s+|\s+[;•]+\s+)/.test(raw);
  if (!listLike) return { raw, items: [], isList: false };

  const items = raw
    .split(/(?:\r?\n|\s*[;•]+\s*)/)
    .map(item => item.trim().replace(/^[-•*]+\s*/, ''))
    .filter(Boolean);

  return { raw, items, isList: items.length > 1 };
}

function isThreeStrikeAutoBan(user) {
  const warningCount = Number(user?.warning_count || 0);
  const banReason = String(user?.ban_reason || '').trim().toLowerCase();

  return Boolean(
    user?.is_banned
      && warningCount >= 3
      && banReason.startsWith('account banned after 3 moderation warnings')
  );
}

function BanReasonList({ reason }) {
  const { raw, items, isList } = parseBanReason(reason);
  if (!raw) return null;

  const visibleItems = (isList ? items : [raw]).filter(item => !/^account banned after 3 moderation warnings\.?$/i.test(String(item || '').trim()));
  if (!visibleItems.length) return null;

  return (
    <div className="cm-admin-ban-reason-card">
      <strong>Reasons for ban</strong>
      {visibleItems.length > 1 ? (
        <ul>
          {visibleItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
      ) : (
        <p>{visibleItems[0]}</p>
      )}
    </div>
  );
}

function AdminModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

function UserAvatar({ user }) {
  const name = user?.full_name || user?.email || 'User';
  const initial = name.trim().charAt(0).toUpperCase() || 'U';
  if (user?.profile_image) return <img className="cm-admin-user-avatar" src={user.profile_image} alt={`${name} profile`} loading="lazy" />;
  return <span className="cm-admin-user-avatar cm-admin-user-avatar-fallback">{initial}</span>;
}

export default function UserManagement({ users = [], saving = false, currentUserId = '', mode = 'users', onSetBan, onRemoveWarning, onIssueWarning }) {
  const [query, setQuery] = useState('');
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [warnTarget, setWarnTarget] = useState(null);
  const [warningReason, setWarningReason] = useState('This is a moderation warning from CineMate. Please avoid hate, spam, harassment, or abusive behaviour.');

  useModalScrollLock(Boolean(banTarget || warnTarget));

  const filteredUsers = useMemo(() => {
    const value = query.trim().toLowerCase();
    return users.filter(user => {
      if (user.user_id === currentUserId) return false;
      if (mode === 'banned' && !user.is_banned) return false;
      if (!value) return true;
      return String(user.full_name || '').toLowerCase().includes(value)
        || String(user.email || '').toLowerCase().includes(value)
        || String(user.role || '').toLowerCase().includes(value);
    });
  }, [query, users, mode, currentUserId]);

  async function confirmBan() {
    if (!banTarget || typeof onSetBan !== 'function') return;
    await onSetBan(banTarget.user_id, true, banReason || 'Banned by admin');
    setBanTarget(null);
    setBanReason('');
  }

  async function confirmWarning() {
    if (!warnTarget || typeof onIssueWarning !== 'function') return;
    await onIssueWarning({
      userId: warnTarget.user_id,
      sourceType: 'manual',
      sourceId: warnTarget.user_id,
      reason: warningReason || 'Warning issued by admin from User Management',
    });
    setWarnTarget(null);
    setWarningReason('This is a moderation warning from CineMate. Please avoid hate, spam, harassment, or abusive behaviour.');
  }

  return (
    <section className="cm-admin-panel cm-admin-wide-panel">
      <div className="cm-admin-section-head">
        <div>
          <p className="cm-admin-eyebrow">User management</p>
          <h3>{mode === 'banned' ? 'Banned Users' : 'Registered Users'}</h3>
          <p className="cm-admin-help-text">Ban/unban accounts. Banned users are blocked from loading CineMate after login.</p>
        </div>
        <input
          className="cm-admin-search"
          type="search"
          placeholder="Search users..."
          value={query}
          onChange={event => setQuery(event.target.value)}
          aria-label="Search users"
        />
      </div>

      <div className="cm-admin-card-list cm-admin-user-list">
        {filteredUsers.map(user => {
          const isSelf = user.user_id === currentUserId;
          return (
            <article key={user.user_id} className="cm-admin-list-card">
              <div className="cm-admin-user-cell">
                <UserAvatar user={user} />
                <div>
                  <strong>{user.full_name || 'CineMate User'}</strong>
                  <span>{user.email || 'No email'}</span>
                </div>
              </div>

              <div className="cm-admin-list-meta">
                <span className={`cm-admin-badge ${user.role === 'admin' ? 'is-admin' : ''}`}>{user.role || 'user'}</span>
                <span className={`cm-admin-badge ${user.is_banned ? 'is-danger' : 'is-ok'}`}>{user.is_banned ? 'Banned' : 'Active'}</span>
                <small>Joined {formatDate(user.created_at)}</small>
              </div>

              <div className="cm-admin-list-stats">
                <span>{Number(user.favourites_count || 0)} favourites</span>
                <span>{Number(user.ratings_count || 0)} ratings</span>
                <span>{Number(user.comments_count || 0)} comments</span>
              </div>

              {user.ban_reason && !isThreeStrikeAutoBan(user) && <BanReasonList reason={user.ban_reason} />}

              {Number(user.warning_count || 0) > 0 && (
                <div className="cm-admin-warning-stack cm-admin-warning-status-card">
                  <div className="cm-admin-warning-status-head">
                    <div>
                      <span>Warning status</span>
                      <strong>{Number(user.warning_count || 0) >= 3 ? 'Final warning issued' : `${Number(user.warning_count || 0)} of 3 strikes used`}</strong>
                    </div>
                    <em>{Math.min(Number(user.warning_count || 0), 3)}/3</em>
                  </div>
                  <div className="cm-admin-warning-meter" aria-hidden="true">
                    <span style={{ width: `${Math.min(Number(user.warning_count || 0), 3) / 3 * 100}%` }}></span>
                  </div>
                  <div className="cm-admin-warning-list">
                    {(user.warnings || []).slice(0, 3).map((warning, index) => (
                      <article key={warning.warning_id} className="cm-admin-warning-row">
                        <button
                          type="button"
                          className="cm-admin-warning-remove"
                          disabled={saving}
                          onClick={() => onRemoveWarning?.(warning.warning_id, 'Removed from user management')}
                          aria-label={`Remove ${index === 0 ? 'first' : index === 1 ? 'second' : 'final'} warning`}
                          title="Remove warning"
                        >
                          ×
                        </button>
                        <span className="cm-admin-warning-title">{index === 0 ? 'Reason 1' : index === 1 ? 'Reason 2' : 'Reason 3 / Final warning'}</span>
                        <p>{warning.reason || 'Warning issued by admin'}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}


              <div className="cm-admin-card-actions">
                {!user.is_banned && Number(user.warning_count || 0) < 3 && (
                  <button
                    type="button"
                    className="cm-admin-mini-btn warning-action"
                    disabled={saving || isSelf}
                    onClick={() => setWarnTarget(user)}
                  >
                    {Number(user.warning_count || 0) >= 2 ? 'Final Warning' : 'Warn User'}
                  </button>
                )}

                {user.is_banned ? (
                  isThreeStrikeAutoBan(user) ? (
                    <span className="cm-admin-ban-note">Remove one strike to unban</span>
                  ) : (
                    <button type="button" className="cm-admin-mini-btn" disabled={saving} onClick={() => onSetBan(user.user_id, false)}>
                      Unban User
                    </button>
                  )
                ) : (
                  <button type="button" className="cm-admin-mini-btn danger" disabled={saving || isSelf} onClick={() => setBanTarget(user)}>
                    Ban User
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!filteredUsers.length && <p className="cm-admin-meta cm-admin-empty">No users match this view.</p>}


      {warnTarget && (
        <AdminModalPortal>
          <div className="cinemate-confirm-backdrop cm-admin-modal-backdrop" role="presentation" onClick={() => setWarnTarget(null)}>
            <div className="cinemate-confirm-modal cm-admin-confirm-modal" role="dialog" aria-modal="true" aria-label="Warn user" onClick={event => event.stopPropagation()}>
              <h4>Warn {warnTarget.full_name || warnTarget.email}?</h4>
              <p>
                This adds one moderation strike to the user. CineMate gives 3 strikes. The third strike is the final warning and automatically blocks the account.
              </p>
              <div className="cm-admin-warning-preview">
                <strong>{Number(warnTarget.warning_count || 0) >= 2 ? 'Account will be blocked after this action' : `${Number(warnTarget.warning_count || 0) + 1}/3 strikes after this warning`}</strong>
                <span>{Number(warnTarget.warning_count || 0) >= 2 ? 'This is the third strike. Issuing it will block the account.' : `${Math.max(0, 2 - Number(warnTarget.warning_count || 0))} strike${2 - Number(warnTarget.warning_count || 0) === 1 ? '' : 's'} left before the final warning.`}</span>
              </div>
              <textarea
                className="cm-admin-reason-input"
                value={warningReason}
                onChange={event => setWarningReason(event.target.value)}
                placeholder="Warning reason..."
                aria-label="Warning reason"
              />
              <div className="cinemate-confirm-actions">
                <button type="button" disabled={saving} onClick={() => setWarnTarget(null)}>Cancel</button>
                <button type="button" className="danger" disabled={saving} onClick={confirmWarning}>{saving ? 'Saving...' : 'Issue Warning'}</button>
              </div>
            </div>
          </div>
        </AdminModalPortal>
      )}

      {banTarget && (
        <AdminModalPortal>
          <div className="cinemate-confirm-backdrop cm-admin-modal-backdrop" role="presentation" onClick={() => setBanTarget(null)}>
            <div className="cinemate-confirm-modal cm-admin-confirm-modal" role="dialog" aria-modal="true" aria-label="Ban user" onClick={event => event.stopPropagation()}>
              <h4>Ban {banTarget.full_name || banTarget.email}?</h4>
              <p>This blocks the user from logging in to CineMate. Their existing content stays available for admin review.</p>
              <textarea
                className="cm-admin-reason-input"
                value={banReason}
                onChange={event => setBanReason(event.target.value)}
                placeholder="Write one paragraph, or put each reason on a new line..."
                aria-label="Ban reason"
              />
              <div className="cinemate-confirm-actions">
                <button type="button" disabled={saving} onClick={() => setBanTarget(null)}>Cancel</button>
                <button type="button" className="danger" disabled={saving} onClick={confirmBan}>{saving ? 'Saving...' : 'Ban User'}</button>
              </div>
            </div>
          </div>
        </AdminModalPortal>
      )}
    </section>
  );
}
