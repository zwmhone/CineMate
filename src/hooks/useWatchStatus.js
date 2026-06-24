'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { cleanMovieId, getWatchStatus, removeWatchStatus, saveWatchStatus } from '@/lib/userInteractions';
import { WATCH_STATUS_PLACEHOLDER, getWatchStatusLabel, getWatchStatusValue } from '@/constants/watchStates';

function getMovieId(movie) {
  try {
    return movie ? cleanMovieId(movie) : null;
  } catch {
    return null;
  }
}

export default function useWatchStatus(movie) {
  const { user, isLoggedIn, ready } = useAuth();
  const movieId = useMemo(() => getMovieId(movie), [movie]);
  const [status, setStatus] = useState(WATCH_STATUS_PLACEHOLDER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      setError('');
      if (!ready || !isLoggedIn || !user?.id || !movieId) {
        setStatus(WATCH_STATUS_PLACEHOLDER);
        return;
      }

      try {
        const savedStatus = await getWatchStatus(movieId, user.id);
        if (active) setStatus(getWatchStatusLabel(savedStatus));
      } catch (nextError) {
        if (active) setError(nextError.message || 'Could not load watch status.');
      }
    }

    loadStatus();
    return () => {
      active = false;
    };
  }, [ready, isLoggedIn, user?.id, movieId]);

  const updateStatus = useCallback(async nextStatus => {
    if (!isLoggedIn || !user?.id) return { success: false, needsLogin: true };
    if (!movieId) {
      const message = 'This movie cannot be saved because its movie ID is missing.';
      setError(message);
      return { success: false, error: message };
    }

    const nextValue = getWatchStatusValue(nextStatus);
    const shouldRemoveStatus = !nextValue || nextStatus === WATCH_STATUS_PLACEHOLDER || String(nextStatus || '').toLowerCase() === 'remove';

    const previousStatus = status;
    const nextLabel = shouldRemoveStatus ? WATCH_STATUS_PLACEHOLDER : getWatchStatusLabel(nextValue);
    setLoading(true);
    setError('');
    setStatus(nextLabel);

    try {
      if (shouldRemoveStatus) {
        await removeWatchStatus(movieId, user.id);
        setStatus(WATCH_STATUS_PLACEHOLDER);
        return { success: true, status: WATCH_STATUS_PLACEHOLDER, removed: true };
      }

      const savedStatus = await saveWatchStatus(movie, user.id, nextValue);
      const savedLabel = getWatchStatusLabel(savedStatus);
      setStatus(savedLabel);
      return { success: true, status: savedLabel };
    } catch (nextError) {
      setStatus(previousStatus);
      const message = nextError.message || 'Could not update watch status.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, user?.id, movieId, movie, status]);

  return { status, loading, error, updateStatus, isLoggedIn };
}
