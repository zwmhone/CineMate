'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteAdminComment,
  dismissAdminCommentReports,
  getAdminOverview,
  hideAdminComment,
  issueAdminModerationWarning,
  listAdminComments,
  listAdminModerationWarnings,
  listAdminMovies,
  listAdminUsers,
  removeAdminModerationWarning,
  setAdminUserBan,
  unhideAdminComment,
} from '@/lib/admin';
import { useAuth } from '@/lib/AuthContext';

function withWarningCounts(users = [], warnings = []) {
  const activeByUser = new Map();
  warnings.forEach(warning => {
    if (warning.status !== 'active') return;
    const current = activeByUser.get(warning.user_id) || [];
    current.push(warning);
    activeByUser.set(warning.user_id, current);
  });

  return users.map(user => {
    const userWarnings = activeByUser.get(user.user_id) || [];
    return {
      ...user,
      warning_count: userWarnings.length,
      warnings: userWarnings,
    };
  });
}

export default function useAdmin() {
  const { user, ready } = useAuth();
  const userId = user?.id || '';
  const isAdminUser = Boolean(user?.isAdmin);
  const hasLoadedRef = useRef(false);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [comments, setComments] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canLoad = Boolean(ready && isAdminUser);

  const refreshAdmin = useCallback(async ({ silent = false } = {}) => {
    if (!ready) return;

    if (!isAdminUser) {
      hasLoadedRef.current = false;
      setOverview(null);
      setUsers([]);
      setWarnings([]);
      setComments([]);
      setMovies([]);
      setLoading(false);
      setError(userId ? 'Admin access required.' : 'Please log in with an admin account.');
      return;
    }

    if (!silent && !hasLoadedRef.current) setLoading(true);
    setError('');

    try {
      const [nextOverview, nextUsers, nextComments, nextMovies, nextWarnings] = await Promise.all([
        getAdminOverview(),
        listAdminUsers(),
        listAdminComments(),
        listAdminMovies(),
        listAdminModerationWarnings(),
      ]);
      setOverview(nextOverview);
      setWarnings(nextWarnings);
      setUsers(withWarningCounts(nextUsers, nextWarnings));
      setComments(nextComments);
      setMovies(nextMovies);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.message || 'Could not load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, [ready, isAdminUser, userId]);

  useEffect(() => {
    if (!ready) return;
    if (!isAdminUser) {
      refreshAdmin({ silent: true });
      return;
    }
    if (!hasLoadedRef.current) refreshAdmin();
  }, [ready, isAdminUser, refreshAdmin]);

  const setUserBan = useCallback(async (targetUserId, shouldBan, reason = '') => {
    setSaving(true);
    setError('');
    try {
      await setAdminUserBan(targetUserId, shouldBan, reason);
      await refreshAdmin({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not update user status.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshAdmin]);

  const issueWarning = useCallback(async ({ userId: targetUserId, sourceType = 'manual', sourceId = '', reason = '' } = {}) => {
    setSaving(true);
    setError('');
    try {
      await issueAdminModerationWarning({ userId: targetUserId, sourceType, sourceId, reason });
      await refreshAdmin({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not issue warning.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshAdmin]);

  const removeWarning = useCallback(async (warningId, reason = '') => {
    setSaving(true);
    setError('');
    try {
      await removeAdminModerationWarning(warningId, reason);
      await refreshAdmin({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not remove warning.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshAdmin]);

  const hideComment = useCallback(async (commentId, reason = 'Removed by admin', sourceType = 'movie') => {
    setSaving(true);
    setError('');
    try {
      await hideAdminComment(commentId, reason, sourceType);
      await refreshAdmin({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not hide comment.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshAdmin]);

  const unhideComment = useCallback(async (commentId, sourceType = 'movie') => {
    setSaving(true);
    setError('');
    try {
      await unhideAdminComment(commentId, sourceType);
      await refreshAdmin({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not restore comment.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshAdmin]);

  const dismissReports = useCallback(async (commentId, sourceType = 'movie') => {
    setSaving(true);
    setError('');
    try {
      await dismissAdminCommentReports(commentId, sourceType);
      await refreshAdmin({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not dismiss reports.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshAdmin]);

  const deleteComment = useCallback(async (commentId, sourceType = 'movie') => {
    setSaving(true);
    setError('');
    try {
      await deleteAdminComment(commentId, sourceType);
      await refreshAdmin({ silent: true });
    } catch (err) {
      setError(err.message || 'Could not delete comment.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshAdmin]);

  return {
    isAdmin: isAdminUser,
    canLoad,
    overview,
    users,
    warnings,
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
  };
}
