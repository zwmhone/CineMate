'use client';

import { useCallback, useEffect, useState } from 'react';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/notifications';

export default function useNotifications(userId) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [setupMissing, setSetupMissing] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setUnreadCount(0);
      setSetupMissing(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await listNotifications(userId, 20);
      setItems(result.items || []);
      setUnreadCount(result.unreadCount || 0);
      setSetupMissing(Boolean(result.setupMissing));
    } catch (nextError) {
      setError(nextError.message || 'Could not load activity.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    if (!userId || typeof window === 'undefined') return undefined;

    const onRefresh = () => refresh();
    window.addEventListener('cinemate:notifications-refresh', onRefresh);
    const interval = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('cinemate:notifications-refresh', onRefresh);
      window.clearInterval(interval);
    };
  }, [refresh, userId]);

  const markOneRead = useCallback(async notificationId => {
    if (!userId || !notificationId) return;
    setItems(previous => previous.map(item => item.id === notificationId ? { ...item, isRead: true } : item));
    setUnreadCount(previous => Math.max(0, previous - 1));
    await markNotificationRead(notificationId, userId);
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setItems(previous => previous.map(item => ({ ...item, isRead: true })));
    setUnreadCount(0);
    await markAllNotificationsRead(userId);
  }, [userId]);

  return { items, unreadCount, loading, error, setupMissing, refresh, markOneRead, markAllRead };
}
