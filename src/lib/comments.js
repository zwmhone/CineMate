import { supabase } from '@/lib/supabaseClient';
import { cleanMovieId, ensureMovieExists } from '@/lib/userInteractions';
import { listCommentReactionSummaries } from '@/lib/commentReactions';
import { createNotification } from '@/lib/notifications';

function buildLocalComment({ movieId, userId, commentText, ratingValue = null, isRatingReview = false, commentId = null, parentCommentId = null }) {
  const now = new Date().toISOString();
  return {
    comment_id: commentId || `local-${userId}-${movieId}-${Date.now()}`,
    user_id: userId,
    movie_id: movieId,
    comment_text: String(commentText || '').trim(),
    rating_value: ratingValue,
    is_rating_review: isRatingReview,
    created_at: now,
    updated_at: now,
    parent_comment_id: parentCommentId || null,
  };
}

function displayNameForUser(userId, userMap = new Map()) {
  const user = userMap.get(userId);
  const name = user?.full_name || user?.email?.split('@')?.[0] || '';
  return name || 'CineMate User';
}

function profileImageForUser(userId, userMap = new Map()) {
  const user = userMap.get(userId);
  return user?.profile_image || null;
}

function formatComment(row, currentUserId = null, userMap = new Map(), currentUserName = '', currentUserImage = '', reactionSummary = null) {
  const userId = row.user_id;
  const isRatingReview = Boolean(row.is_rating_review);
  const rating = isRatingReview ? Number(row.rating_value || 0) : 0;
  const author = currentUserId && currentUserId === userId
    ? (currentUserName || displayNameForUser(userId, userMap) || 'You')
    : displayNameForUser(userId, userMap);

  const reactions = reactionSummary || {};

  return {
    id: row.comment_id,
    userId,
    movieId: row.movie_id,
    text: row.comment_text || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author,
    profileImage: currentUserId && currentUserId === userId ? (currentUserImage || profileImageForUser(userId, userMap)) : profileImageForUser(userId, userMap),
    rating,
    isRatingReview,
    isHidden: Boolean(row.is_hidden),
    canEdit: Boolean(currentUserId && currentUserId === userId && !isRatingReview),
    canRemoveReviewText: Boolean(currentUserId && currentUserId === userId && isRatingReview),
    canReport: Boolean(currentUserId && currentUserId !== userId && !row.is_hidden),
    canReact: Boolean(currentUserId && !row.is_hidden),
    likes: Number(reactions.likes || 0),
    dislikes: Number(reactions.dislikes || 0),
    userReaction: reactions.userReaction || null,
    parentId: row.parent_comment_id || null,
    isReply: Boolean(row.parent_comment_id),
    canReply: Boolean(currentUserId && !row.is_hidden),
  };
}

export async function addMovieComment(movie, userId, commentText, parentCommentId = null) {
  if (!userId) throw new Error('Please log in before posting a comment.');

  const text = String(commentText || '').trim();
  if (!text) return null;

  const movieId = await ensureMovieExists(movie);
  const parentId = parentCommentId || null;
  let parentData = null;

  if (parentId) {
    const parent = await supabase
      .from('comments')
      .select('comment_id,movie_id,user_id,is_hidden')
      .eq('comment_id', parentId)
      .eq('movie_id', movieId)
      .maybeSingle();

    if (parent.error) throw new Error(parent.error.message);
    if (!parent.data || parent.data.is_hidden) throw new Error('The comment you are replying to is no longer available.');
    parentData = parent.data;
  }

  const payload = { user_id: userId, movie_id: movieId, comment_text: text };
  if (parentId) payload.parent_comment_id = parentId;

  const { data, error } = await supabase
    .from('comments')
    .insert(payload)
    .select('comment_id,user_id,movie_id,comment_text,rating_value,is_rating_review,is_hidden,parent_comment_id,created_at,updated_at')
    .maybeSingle();

  if (error) {
    if (parentId && /parent_comment_id|schema cache|column/i.test(error.message || '')) {
      throw new Error('Movie comment replies need movie_comment_replies.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  const savedComment = data || buildLocalComment({ movieId, userId, commentText: text, parentCommentId: parentId });

  if (parentId && parentData?.user_id && parentData.user_id !== userId) {
    await createNotification({
      userId: parentData.user_id,
      actorId: userId,
      type: 'movie_comment_reply',
      entityType: 'movie',
      entityId: movieId,
      metadata: {
        movieId,
        movieTitle: movie?.title || '',
        commentId: savedComment.comment_id,
        parentCommentId: parentId,
      },
    });
  }

  return savedComment;
}

export async function updateMovieComment(commentId, userId, commentText) {
  if (!userId) throw new Error('Please log in before editing a comment.');

  const text = String(commentText || '').trim();
  if (!text) throw new Error('Comment cannot be empty.');

  let result = await supabase
    .from('comments')
    .update({ comment_text: text, updated_at: new Date().toISOString() })
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .select('comment_id,user_id,movie_id,comment_text,rating_value,is_rating_review,is_hidden,parent_comment_id,created_at,updated_at')
    .maybeSingle();

  if (result.error && /rating_value|is_rating_review|updated_at|is_hidden|parent_comment_id/i.test(result.error.message || '')) {
    result = await supabase
      .from('comments')
      .update({ comment_text: text })
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .select('comment_id,user_id,movie_id,comment_text,created_at')
      .maybeSingle();
  }

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function deleteMovieComment(commentId, userId) {
  if (!userId) throw new Error('Please log in before deleting a comment.');

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return true;
}

export async function reportMovieComment(commentId, userId, reason = 'Inappropriate comment', details = '') {
  if (!userId) throw new Error('Please log in before reporting a comment.');
  if (!commentId) throw new Error('Comment is missing.');

  const { data: commentContext } = await supabase
    .from('comments')
    .select('comment_id,user_id,movie_id')
    .eq('comment_id', commentId)
    .maybeSingle();

  const { error } = await supabase.rpc('report_comment', {
    target_comment_id: commentId,
    report_reason: reason || 'Inappropriate comment',
    report_details: details || null,
  });

  if (error) {
    const message = String(error.message || 'Could not report this comment.');
    if (/function.*report_comment|schema cache|could not find|not found/i.test(message)) {
      throw new Error('Comment reporting needs database/admin_moderation.sql to be run once in Supabase.');
    }
    throw new Error(message);
  }

  if (commentContext?.user_id && commentContext.user_id !== userId) {
    await createNotification({
      userId: commentContext.user_id,
      actorId: null,
      type: 'movie_comment_reported',
      entityType: 'movie',
      entityId: commentContext.movie_id,
      metadata: { movieId: commentContext.movie_id, commentId },
    });
  }

  return true;
}

export async function deleteUserRatingReview(movieId, userId) {
  if (!userId) throw new Error('Please log in before removing your review text.');
  if (!movieId) return true;

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('movie_id', cleanMovieId(movieId))
    .eq('user_id', userId)
    .eq('is_rating_review', true);

  if (error) throw new Error(error.message);
  return true;
}

async function getUserProfiles(userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  const { data, error } = await supabase
    .from('users')
    .select('user_id,full_name,email,profile_image')
    .in('user_id', uniqueIds);

  if (error) return new Map();
  return new Map((data || []).map(user => [user.user_id, user]));
}

export async function getUserRatingReview(movieId, userId) {
  if (!movieId || !userId) return null;

  const cleanId = cleanMovieId(movieId);
  const { data, error } = await supabase
    .from('comments')
    .select('comment_id,user_id,movie_id,comment_text,rating_value,is_rating_review,parent_comment_id,created_at,updated_at')
    .eq('movie_id', cleanId)
    .eq('user_id', userId)
    .eq('is_rating_review', true)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) return null;
  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function upsertRatingReview(movie, userId, ratingValue, reviewText) {
  if (!userId) throw new Error('Please log in before saving your review.');

  const text = String(reviewText || '').trim();
  if (!text) return null;

  const movieId = await ensureMovieExists(movie);
  const existing = await getUserRatingReview(movieId, userId);
  const payload = {
    user_id: userId,
    movie_id: movieId,
    comment_text: text,
    rating_value: Number(ratingValue || 0),
    is_rating_review: true,
    updated_at: new Date().toISOString(),
  };

  let result;

  if (existing?.comment_id) {
    result = await supabase
      .from('comments')
      .update(payload)
      .eq('comment_id', existing.comment_id)
      .eq('user_id', userId)
      .select('comment_id,user_id,movie_id,comment_text,rating_value,is_rating_review,parent_comment_id,created_at,updated_at')
      .maybeSingle();
  } else {
    result = await supabase
      .from('comments')
      .insert(payload)
      .select('comment_id,user_id,movie_id,comment_text,rating_value,is_rating_review,parent_comment_id,created_at,updated_at')
      .maybeSingle();
  }

  if (result.error) throw new Error(result.error.message);
  return result.data || buildLocalComment({ movieId, userId, commentText: text, ratingValue, isRatingReview: true });
}

export async function listMovieComments(movieId, currentUserId = null, currentUserName = '', currentUserImage = '') {
  if (!movieId) return [];

  const cleanId = cleanMovieId(movieId);

  let result = await supabase
    .from('comments')
    .select('comment_id,user_id,movie_id,comment_text,rating_value,is_rating_review,is_hidden,parent_comment_id,created_at,updated_at')
    .eq('movie_id', cleanId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });

  if (result.error && /rating_value|is_rating_review|updated_at|is_hidden|parent_comment_id/i.test(result.error.message || '')) {
    result = await supabase
      .from('comments')
      .select('comment_id,user_id,movie_id,comment_text,created_at')
      .eq('movie_id', cleanId)
      .order('created_at', { ascending: false });
  }

  if (result.error) throw new Error(result.error.message);

  const rows = result.data || [];
  const userIds = rows.map(comment => comment.user_id);
  const userMap = await getUserProfiles(userIds);
  const reactionSummaries = await listCommentReactionSummaries(rows.map(comment => comment.comment_id), currentUserId);

  if (currentUserId && currentUserImage) {
    const currentProfile = userMap.get(currentUserId) || {};
    userMap.set(currentUserId, { ...currentProfile, profile_image: currentUserImage });
  }

  return rows.map(row => formatComment(row, currentUserId, userMap, currentUserName, currentUserImage, reactionSummaries.get(row.comment_id)));
}

export function normaliseLocalComment(row, currentUserId, currentUserName = '', currentUserImage = '') {
  const userMap = new Map([[currentUserId, { full_name: currentUserName, profile_image: currentUserImage || null }]]);
  return formatComment(row, currentUserId, userMap, currentUserName, currentUserImage, { likes: 0, dislikes: 0, userReaction: null });
}
