import { supabase } from '@/lib/supabaseClient';
import { deleteMovieComment, getUserRatingReview } from '@/lib/comments';
import { cleanMovieId, ensureMovieExists, isDuplicateError } from '@/lib/userInteractions';

function normaliseRatingValue(ratingValue) {
  const value = Number(ratingValue);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error('Please choose a rating from 1 to 5 stars.');
  }
  return value;
}

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localRatingRow(userId, movieId, value, row = {}) {
  const now = new Date().toISOString();
  return {
    rating_id: row.rating_id || createUuid(),
    user_id: row.user_id || userId,
    movie_id: row.movie_id || movieId,
    rating_value: Number(row.rating_value ?? value),
    created_at: row.created_at || now,
    updated_at: row.updated_at || now,
  };
}

export async function getUserRating(movieId, userId) {
  if (!userId || !movieId) return null;

  const { data, error } = await supabase
    .from('ratings')
    .select('rating_id,user_id,movie_id,rating_value,created_at,updated_at')
    .eq('user_id', userId)
    .eq('movie_id', cleanMovieId(movieId))
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function getUserRatingWithReview(movieId, userId) {
  const rating = await getUserRating(movieId, userId);
  const review = await getUserRatingReview(movieId, userId);

  return {
    rating,
    review,
    ratingValue: Number(rating?.rating_value || review?.rating_value || 0),
    reviewText: review?.comment_text || '',
  };
}

async function findExistingRating(userId, movieId) {
  const { data, error } = await supabase
    .from('ratings')
    .select('rating_id,user_id,movie_id,rating_value,created_at,updated_at')
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function updateRatingById(ratingId, userId, movieId, value) {
  const payload = { rating_value: value, updated_at: new Date().toISOString() };

  let result = await supabase
    .from('ratings')
    .update(payload)
    .eq('rating_id', ratingId)
    .eq('user_id', userId)
    .select('rating_id,user_id,movie_id,rating_value,created_at,updated_at')
    .maybeSingle();

  if (!result.error) return result;

  if (/updated_at/i.test(result.error.message || '')) {
    result = await supabase
      .from('ratings')
      .update({ rating_value: value })
      .eq('rating_id', ratingId)
      .eq('user_id', userId)
      .select('rating_id,user_id,movie_id,rating_value,created_at,updated_at')
      .maybeSingle();
  }

  if (!result.error) return result;

  const verify = await getUserRating(movieId, userId);
  if (verify) return { data: verify, error: null };

  return result;
}

async function insertRating(userId, movieId, value) {
  const payload = {
    rating_id: createUuid(),
    user_id: userId,
    movie_id: movieId,
    rating_value: value,
  };

  return supabase
    .from('ratings')
    .insert(payload)
    .select('rating_id,user_id,movie_id,rating_value,created_at,updated_at')
    .maybeSingle();
}

async function deleteExtraRatings(userId, movieId, keepRatingId) {
  if (!keepRatingId) return;

  const { data } = await supabase
    .from('ratings')
    .select('rating_id')
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .neq('rating_id', keepRatingId);

  const extraIds = (data || []).map(row => row.rating_id).filter(Boolean);
  if (!extraIds.length) return;

  await supabase
    .from('ratings')
    .delete()
    .in('rating_id', extraIds)
    .eq('user_id', userId);
}

export async function saveUserRating(movie, userId, ratingValue) {
  if (!userId) throw new Error('Please log in before rating movies.');

  const value = normaliseRatingValue(ratingValue);
  const movieId = await ensureMovieExists(movie);
  const existing = await findExistingRating(userId, movieId);

  if (existing?.rating_id) {
    const updateResult = await updateRatingById(existing.rating_id, userId, movieId, value);
    if (updateResult.error) throw new Error(updateResult.error.message);
    await deleteExtraRatings(userId, movieId, existing.rating_id);
    return localRatingRow(userId, movieId, value, updateResult.data || existing);
  }

  const insertResult = await insertRating(userId, movieId, value);
  if (insertResult.error) {
    if (isDuplicateError(insertResult.error)) {
      const duplicate = await findExistingRating(userId, movieId);
      if (duplicate?.rating_id) {
        const updateResult = await updateRatingById(duplicate.rating_id, userId, movieId, value);
        if (updateResult.error) throw new Error(updateResult.error.message);
        await deleteExtraRatings(userId, movieId, duplicate.rating_id);
        return localRatingRow(userId, movieId, value, updateResult.data || duplicate);
      }
    }

    throw new Error(insertResult.error.message);
  }

  const saved = insertResult.data || await getUserRating(movieId, userId);
  if (!saved) {
    throw new Error('Rating was submitted, but Supabase did not return the saved row. Please check the ratings RLS policies.');
  }

  await deleteExtraRatings(userId, movieId, saved.rating_id);
  return localRatingRow(userId, movieId, value, saved);
}

export async function deleteUserRating(movieId, userId) {
  if (!userId) throw new Error('Please log in before deleting a rating.');
  if (!movieId) return true;

  const cleanId = cleanMovieId(movieId);
  const review = await getUserRatingReview(cleanId, userId);

  if (review?.comment_id) {
    await deleteMovieComment(review.comment_id, userId);
  }

  const { error } = await supabase
    .from('ratings')
    .delete()
    .eq('user_id', userId)
    .eq('movie_id', cleanId);

  if (error) throw new Error(error.message);
  return true;
}

export async function listUserRatings(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('ratings')
    .select('created_at,updated_at,rating_value,movie_id,movies(movie_id,title,poster_url,genres,overview,release_date,tmdb_rating,runtime)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);
  return data || [];
}
