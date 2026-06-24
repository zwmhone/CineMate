import { supabase } from '@/lib/supabaseClient';
import { cleanMovieId, ensureMovieExists, isDuplicateError } from '@/lib/userInteractions';

export const RECOMMENDATION_FEEDBACK = {
  NOT_INTERESTED: 'not_interested',
};

function normaliseFeedbackType(type) {
  const value = String(type || '').trim().toLowerCase().replace(/\s+/g, '_');
  return value === RECOMMENDATION_FEEDBACK.NOT_INTERESTED ? value : '';
}


function notifyRecommendationFeedbackChange(movieId, feedbackType, isDisliked) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cinemate:recommendation-feedback-change', {
    detail: { movieId: Number(movieId), feedbackType, isDisliked: Boolean(isDisliked) },
  }));
}

function feedbackTableMissing(error) {
  return /recommendation_feedback|does not exist|schema cache/i.test(error?.message || '');
}

function getFriendlyFeedbackError(error) {
  if (feedbackTableMissing(error)) {
    return 'Recommendation feedback is not available yet. Please run recommendation_feedback.sql once.';
  }
  return error?.message || 'Could not update recommendation feedback.';
}

export async function getRecommendationFeedback(movieOrId, userId, feedbackType = RECOMMENDATION_FEEDBACK.NOT_INTERESTED) {
  if (!userId || !movieOrId) return null;

  const type = normaliseFeedbackType(feedbackType);
  if (!type) return null;

  const movieId = cleanMovieId(movieOrId);
  const { data, error } = await supabase
    .from('recommendation_feedback')
    .select('feedback_id,user_id,movie_id,feedback_type,created_at,updated_at')
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .eq('feedback_type', type)
    .limit(1);

  if (error) throw new Error(getFriendlyFeedbackError(error));
  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function saveRecommendationFeedback(movie, userId, feedbackType = RECOMMENDATION_FEEDBACK.NOT_INTERESTED) {
  if (!userId) throw new Error('Please log in before saving recommendation feedback.');

  const type = normaliseFeedbackType(feedbackType);
  if (!type) throw new Error('Unsupported recommendation feedback type.');

  const movieId = await ensureMovieExists(movie);
  const existing = await getRecommendationFeedback(movieId, userId, type);
  if (existing) {
    notifyRecommendationFeedbackChange(movieId, type, true);
    return existing;
  }

  const payload = {
    user_id: userId,
    movie_id: movieId,
    feedback_type: type,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('recommendation_feedback')
    .insert(payload)
    .select('feedback_id,user_id,movie_id,feedback_type,created_at,updated_at')
    .single();

  if (error) {
    if (isDuplicateError(error)) return getRecommendationFeedback(movieId, userId, type);
    throw new Error(getFriendlyFeedbackError(error));
  }

  notifyRecommendationFeedbackChange(movieId, type, true);
  return data || { user_id: userId, movie_id: movieId, feedback_type: type };
}

export async function removeRecommendationFeedback(movieOrId, userId, feedbackType = RECOMMENDATION_FEEDBACK.NOT_INTERESTED) {
  if (!userId) throw new Error('Please log in before updating recommendation feedback.');

  const type = normaliseFeedbackType(feedbackType);
  if (!type) throw new Error('Unsupported recommendation feedback type.');

  const movieId = cleanMovieId(movieOrId);
  const { error } = await supabase
    .from('recommendation_feedback')
    .delete()
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .eq('feedback_type', type);

  if (error) throw new Error(getFriendlyFeedbackError(error));
  notifyRecommendationFeedbackChange(movieId, type, false);
  return { user_id: userId, movie_id: movieId, feedback_type: type, removed: true };
}

export async function toggleRecommendationFeedback(movie, userId, feedbackType = RECOMMENDATION_FEEDBACK.NOT_INTERESTED) {
  if (!userId) throw new Error('Please log in before updating recommendation feedback.');

  const type = normaliseFeedbackType(feedbackType);
  if (!type) throw new Error('Unsupported recommendation feedback type.');

  const movieId = await ensureMovieExists(movie);
  const existing = await getRecommendationFeedback(movieId, userId, type);

  if (existing) {
    await removeRecommendationFeedback(movieId, userId, type);
    return { isDisliked: false, removed: true };
  }

  await saveRecommendationFeedback(movie, userId, type);
  return { isDisliked: true, removed: false };
}

export async function listRecommendationFeedback(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('recommendation_feedback')
    .select('feedback_type,movie_id,created_at,updated_at,movies(movie_id,title,poster_url,genres,overview,release_date,tmdb_rating,runtime)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw new Error(getFriendlyFeedbackError(error));

  return data || [];
}
