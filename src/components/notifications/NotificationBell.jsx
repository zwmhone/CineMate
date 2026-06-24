'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import useNotifications from '@/hooks/useNotifications';

function NotificationAvatar({ actor }) {
  if (actor?.profileImage) {
    return <img src={actor.profileImage} alt={`${actor.name} profile`} loading="lazy" />;
  }
  return <span aria-hidden="true">{actor?.initial || 'C'}</span>;
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22a2.8 2.8 0 0 0 2.74-2.2H9.26A2.8 2.8 0 0 0 12 22Zm7-6.4-1.7-2.05V9.8a5.34 5.34 0 0 0-4.1-5.2V3.8a1.2 1.2 0 0 0-2.4 0v.8a5.34 5.34 0 0 0-4.1 5.2v3.75L5 15.6a1.2 1.2 0 0 0 .92 1.97h12.16A1.2 1.2 0 0 0 19 15.6Z" />
    </svg>
  );
}

export default function NotificationBell({ userId = '', onNavigate }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const panelRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { items, unreadCount, loading, error, setupMissing, refresh, markOneRead, markAllRead } = useNotifications(userId);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function close(event) {
      const target = event.target;
      if (wrapperRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function toggleOpen() {
    setOpen(value => !value);
    if (!open) refresh();
  }

  async function handleOpenItem(item, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const isWarning = item.type === 'moderation_warning' || item.type === 'moderation_ban';

    if (isWarning) {
      // Open the modal before closing the mobile menu so the tap works reliably in responsive mode.
      window.dispatchEvent(new CustomEvent('cinemate:open-moderation-warning', { detail: item }));
      setOpen(false);
      if (typeof onNavigate === 'function') {
        window.setTimeout(() => onNavigate(), 0);
      }
      if (!item.isRead) {
        markOneRead(item.id).catch(error => console.warn('Notification could not be marked read:', error.message));
      }
      return;
    }

    if (!item.isRead) await markOneRead(item.id);
    if (item.href) router.push(item.href);
    setOpen(false);
    if (typeof onNavigate === 'function') onNavigate();
  }

  const notificationPanel = open ? (
    <div className="notification-panel" role="dialog" aria-label="Activity notifications" ref={panelRef}>
      <div className="notification-panel-head">
        <div>
          <p className="eyebrow">Activity</p>
          <h3>Notifications</h3>
        </div>
        <div className="notification-panel-actions">
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead}>Mark all read</button>
          )}
          <button type="button" className="notification-close-button" aria-label="Close notifications" onClick={() => setOpen(false)}>×</button>
        </div>
      </div>

      {setupMissing ? (
        <div className="notification-empty">
          <strong>Activity setup needed</strong>
          <p>Run database/notifications.sql once in Supabase to enable the activity bell.</p>
        </div>
      ) : loading && !items.length ? (
        <div className="notification-empty"><p>Loading activity...</p></div>
      ) : error ? (
        <div className="notification-empty error"><p>{error}</p></div>
      ) : !items.length ? (
        <div className="notification-empty">
          <strong>No activity yet</strong>
          <p>Likes, replies, follows, and collection invites will appear here.</p>
        </div>
      ) : (
        <div className="notification-list">
          {items.map(item => {
            const isAnonymous = item.actor?.isAnonymous;
            const content = (
              <>
                {!isAnonymous && <span className="notification-avatar"><NotificationAvatar actor={item.actor} /></span>}
                <span className="notification-copy">
                  <span>{item.message}</span>
                  <small>{item.timeLabel}</small>
                </span>
                {!item.isRead && <span className="notification-dot" aria-hidden="true"></span>}
              </>
            );
            return (
              <button
                key={item.id}
                type="button"
                className={`notification-item notification-item-button ${isAnonymous ? 'is-anonymous' : ''} ${item.isRead ? '' : 'unread'}`}
                onClick={event => handleOpenItem(item, event)}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="notification-bell-wrap" ref={wrapperRef}>
      <button
        type="button"
        className={`notification-bell ${open ? 'active' : ''}`}
        aria-label={unreadCount ? `${unreadCount} unread activity notifications` : 'Activity notifications'}
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {mounted && notificationPanel ? createPortal(notificationPanel, document.body) : null}
    </div>
  );
}
