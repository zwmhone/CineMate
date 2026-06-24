'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { cleanMovieId } from '@/lib/userInteractions';
import {
  getRecommendationFeedback,
  RECOMMENDATION_FEEDBACK,
  toggleRecommendationFeedback,
} from '@/lib/recommendationFeedback';

function getMovieId(movie) {
  try {
    return movie ? cleanMovieId(movie) : null;
  } catch {
    return null;
  }
}

export default function useRecommendationFeedback(movie) {
  const { user, isLoggedIn, ready } = useAuth();
  const movieId = useMemo(() => getMovieId(movie), [movie]);
  const [isDisliked, setIsDisliked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadFeedbackState() {
      setError('');
      if (!ready || !isLoggedIn || !user?.id || !movieId) {
        setIsDisliked(false);
        return;
      }

      try {
        const saved = await getRecommendationFeedback(movieId, user.id, RECOMMENDATION_FEEDBACK.NOT_INTERESTED);
        if (active) setIsDisliked(Boolean(saved));
      } catch (nextError) {
        if (active) setError(nextError.message || 'Could not load dislike state.');
      }
    }

    function handleFeedbackChange(event) {
      const detail = event?.detail || {};
      if (Number(detail.movieId) !== Number(movieId)) return;
      if (detail.feedbackType !== RECOMMENDATION_FEEDBACK.NOT_INTERESTED) return;
      setIsDisliked(Boolean(detail.isDisliked));
    }

    loadFeedbackState();
    window.addEventListener('cinemate:recommendation-feedback-change', handleFeedbackChange);

    return () => {
      active = false;
      window.removeEventListener('cinemate:recommendation-feedback-change', handleFeedbackChange);
    };
  }, [ready, isLoggedIn, user?.id, movieId]);

  const toggleDislike = useCallback(async () => {
    if (!isLoggedIn || !user?.id) return { success: false, needsLogin: true };
    if (!movieId) {
      const message = 'This title cannot be disliked because its movie ID is missing.';
      setError(message);
      return { success: false, error: message };
    }

    const previousState = isDisliked;
    setLoading(true);
    setError('');
    setIsDisliked(current => !current);

    try {
      const result = await toggleRecommendationFeedback(movie, user.id, RECOMMENDATION_FEEDBACK.NOT_INTERESTED);
      setIsDisliked(Boolean(result.isDisliked));
      return { success: true, isDisliked: Boolean(result.isDisliked) };
    } catch (nextError) {
      setIsDisliked(previousState);
      const message = nextError.message || 'Could not update dislike feedback.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, user?.id, movieId, movie, isDisliked]);

  return { isDisliked, loading, error, toggleDislike };
}
