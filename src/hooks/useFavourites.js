'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { cleanMovieId, isMovieFavourite, toggleFavourite as saveToggleFavourite } from '@/lib/userInteractions';

function getMovieId(movie) {
  try {
    return movie ? cleanMovieId(movie) : null;
  } catch {
    return null;
  }
}

export default function useFavourites(movie) {
  const { user, isLoggedIn, ready } = useAuth();
  const movieId = useMemo(() => getMovieId(movie), [movie]);
  const [isFavourite, setIsFavourite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadFavouriteState() {
      setError('');
      if (!ready || !isLoggedIn || !user?.id || !movieId) {
        setIsFavourite(false);
        return;
      }

      try {
        const saved = await isMovieFavourite(movieId, user.id);
        if (active) setIsFavourite(saved);
      } catch (nextError) {
        if (active) setError(nextError.message || 'Could not load favourite state.');
      }
    }

    loadFavouriteState();
    return () => {
      active = false;
    };
  }, [ready, isLoggedIn, user?.id, movieId]);

  const toggleFavourite = useCallback(async () => {
    if (!isLoggedIn || !user?.id) return { success: false, needsLogin: true };
    if (!movieId) {
      const message = 'This movie cannot be saved because its movie ID is missing.';
      setError(message);
      return { success: false, error: message };
    }

    const previousState = isFavourite;
    setLoading(true);
    setError('');

    try {
      const result = await saveToggleFavourite(movie, user.id);
      setIsFavourite(result.isFavourite);
      return { success: true, isFavourite: result.isFavourite };
    } catch (nextError) {
      setIsFavourite(previousState);
      const message = nextError.message || 'Could not update favourites.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, user?.id, movieId, movie, isFavourite]);

  return { isFavourite, loading, error, toggleFavourite };
}
