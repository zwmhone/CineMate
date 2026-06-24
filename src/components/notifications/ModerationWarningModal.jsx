'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listUnreadModerationAlerts, markNotificationRead } from '@/lib/notifications';
import useModalScrollLock from '@/hooks/useModalScrollLock';

function cleanReason(value = '') {
  return String(value || '').trim();
}

function alertSignature(item) {
  if (!item) return '';
  const metadata = item.metadata || {};
  return [item.type, metadata.strikeNumber || '', metadata.reason || '', metadata.banned ? 'banned' : ''].join(':');
}

function reasonListFromMetadata(metadata = {}) {
  if (Array.isArray(metadata.allReasons) && metadata.allReasons.length) {
    return metadata.allReasons
      .map((item, index) => ({
        label: item?.label || (index === 0 ? 'First warning' : index === 1 ? 'Second warning' : 'Final warning'),
        reason: cleanReason(item?.reason),
      }))
      .filter(item => item.reason);
  }
  return [];
}

function strikeLabel(item) {
  const metadata = item?.metadata || {};
  const strikeNumber = Number(metadata.strikeNumber || 1);
  const maxStrikes = Number(metadata.maxStrikes || 3);
  return `${Math.min(strikeNumber, maxStrikes)}/${maxStrikes}`;
}

function dismissedKey(userId = '') {
  return `cinemate:moderation-alert-seen:${userId}`;
}

function readDismissedIds(userId = '') {
  if (typeof window === 'undefined' || !userId) return new Set();
  try {
    const values = JSON.parse(window.localStorage.getItem(dismissedKey(userId)) || '[]');
    return new Set(Array.isArray(values) ? values : []);
  } catch {
    return new Set();
  }
}

function rememberDismissedId(userId = '', notificationId = '', signature = '') {
  if (typeof window === 'undefined' || !userId || !notificationId) return;
  const ids = Array.from(readDismissedIds(userId));
  const values = [notificationId, signature].filter(Boolean);
  const next = [...values, ...ids.filter(id => !values.includes(id))].slice(0, 50);
  window.localStorage.setItem(dismissedKey(userId), JSON.stringify(next));
}

export default function ModerationWarningModal({ userId = '' }) {
  const [alertItem, setAlertItem] = useState(null);
  const [mounted, setMounted] = useState(false);
  const loadingRef = useRef(false);
  const activeAlertIdRef = useRef('');

  const isOpen = Boolean(alertItem);
  useModalScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadAlert = useCallback(async () => {
    if (!userId || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const result = await listUnreadModerationAlerts(userId, 5);
      const dismissedIds = readDismissedIds(userId);
      const nextAlert = (result.items || []).find(item => {
        if (item.type !== 'moderation_warning' && item.type !== 'moderation_ban') return false;
        return !dismissedIds.has(item.id) && !dismissedIds.has(alertSignature(item));
      });
      if (nextAlert && nextAlert.id !== activeAlertIdRef.current) {
        activeAlertIdRef.current = nextAlert.id;
        setAlertItem(nextAlert);
      }
    } catch (error) {
      console.warn('Moderation alert could not be loaded:', error.message);
    } finally {
      loadingRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setAlertItem(null);
      return undefined;
    }

    loadAlert();
    if (typeof window === 'undefined') return undefined;

    const onRefresh = () => loadAlert();
    const onOpenWarning = event => {
      const item = event?.detail;
      if (!item || (item.type !== 'moderation_warning' && item.type !== 'moderation_ban')) return;
      activeAlertIdRef.current = item.id || '';
      setAlertItem(item);
    };
    window.addEventListener('cinemate:notifications-refresh', onRefresh);
    window.addEventListener('cinemate:open-moderation-warning', onOpenWarning);
    const interval = window.setInterval(loadAlert, 30000);
    return () => {
      window.removeEventListener('cinemate:notifications-refresh', onRefresh);
      window.removeEventListener('cinemate:open-moderation-warning', onOpenWarning);
      window.clearInterval(interval);
    };
  }, [loadAlert, userId]);

  const content = useMemo(() => {
    if (!alertItem) return null;
    const metadata = alertItem.metadata || {};
    const reason = cleanReason(metadata.reason);
    const isBan = alertItem.type === 'moderation_ban' || metadata.banned;
    const reasons = reasonListFromMetadata(metadata);
    return {
      isBan,
      title: isBan ? 'Account banned' : (Number(metadata.strikeNumber || 1) >= 3 || metadata.finalWarning ? 'Final moderation warning' : `Moderation warning ${strikeLabel(alertItem)}`),
      eyebrow: isBan ? 'Final action' : 'CineMate moderation',
      message: isBan
        ? 'Your CineMate account has been banned by an administrator.'
        : (Number(metadata.strikeNumber || 1) >= 3 || metadata.finalWarning
          ? 'This is your final warning. Your account has been banned after reaching 3 moderation strikes.'
          : `You received strike ${strikeLabel(alertItem)} for breaking CineMate community rules.`),
      reason,
      reasons,
    };
  }, [alertItem]);

  async function closeAlert() {
    const current = alertItem;
    setAlertItem(null);
    if (current?.id && userId) {
      rememberDismissedId(userId, current.id, alertSignature(current));
      await markNotificationRead(current.id, userId).catch(error => {
        console.warn('Moderation alert could not be marked read:', error.message);
      });
    }
  }

  if (!alertItem || !content || !mounted || typeof document === 'undefined') return null;

  const modal = (
    <div className="cinemate-confirm-backdrop moderation-warning-backdrop global-modal-backdrop" role="presentation" onClick={closeAlert}>
      <div className="cinemate-confirm-modal moderation-warning-modal global-modal-panel" role="alertdialog" aria-modal="true" aria-label={content.title} onClick={event => event.stopPropagation()}>
        <p className="moderation-warning-eyebrow">{content.eyebrow}</p>
        <h4>{content.title}</h4>
        <p>{content.message}</p>
        {content.isBan && content.reasons?.length > 0 ? (
          <div className="moderation-warning-reason">
            <strong>You are banned for the following reasons</strong>
            <ul className="moderation-warning-reason-list">
              {content.reasons.map((item, index) => (
                <li key={`${item.label}-${index}`}><b>{item.label}:</b> {item.reason}</li>
              ))}
            </ul>
          </div>
        ) : content.reason ? (
          <div className="moderation-warning-reason">
            <strong>Reason</strong>
            <span>{content.reason}</span>
          </div>
        ) : null}
        {!content.isBan && <p className="moderation-warning-note">CineMate gives 3 moderation strikes. The third strike is the final warning and can ban the account. Please avoid hate, spam, harassment, or abusive comments.</p>}
        <div className="cinemate-confirm-actions">
          <button type="button" className={content.isBan ? 'danger' : ''} onClick={closeAlert}>{content.isBan ? 'Close' : 'I understand'}</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
