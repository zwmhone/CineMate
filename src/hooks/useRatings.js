'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteUserRating, getUserRatingWithReview, saveUserRating } from '@/lib/ratings';
import { useAuth } from '@/lib/AuthContext';
import { cleanMovieId } from '@/lib/userInteractions';

function getMovieId(movie) {
  try {
    return movie ? cleanMovieId(movie) : null;
  } catch {
    return null;
  }
}

export default function useRatings(movie) {
  const { user, isLoggedIn } = useAuth();
  const [rating, setRating] = useState(0);
  const [ratingReview, setRatingReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const movieId = getMovieId(movie);

  const refreshRating = useCallback(async () => {
    if (!isLoggedIn || !user?.id || !movieId) {
      setRating(0);
      setRatingReview(null);
      return 0;
    }

    try {
      const result = await getUserRatingWithReview(movieId, user.id);
      const value = Number(result?.ratingValue || 0);
      setRating(value);
      setRatingReview(result?.review || null);
      return value;
    } catch (err) {
      setError(err.message || 'Could not load your rating.');
      return 0;
    }
  }, [isLoggedIn, movieId, user?.id]);

  useEffect(() => {
    refreshRating();
  }, [refreshRating]);

  const saveRating = useCallback(async ratingValue => {
    if (!isLoggedIn || !user?.id) throw new Error('Please log in before rating movies.');

    setLoading(true);
    setError('');

    try {
      const row = await saveUserRating(movie, user.id, ratingValue);
      const value = Number(row?.rating_value || ratingValue || 0);
      setRating(value);
      await refreshRating();
      return value;
    } catch (err) {
      setError(err.message || 'Could not save your rating.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, movie, refreshRating, user?.id]);

  const deleteRating = useCallback(async () => {
    if (!isLoggedIn || !user?.id) throw new Error('Please log in before deleting a rating.');

    setLoading(true);
    setError('');

    try {
      await deleteUserRating(movieId, user.id);
      setRating(0);
      setRatingReview(null);
      await refreshRating();
      return true;
    } catch (err) {
      setError(err.message || 'Could not delete your rating.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, movieId, refreshRating, user?.id]);

  return { rating, ratingReview, loading, error, refreshRating, saveRating, deleteRating };
}
