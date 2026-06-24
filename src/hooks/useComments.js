'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addMovieComment,
  deleteMovieComment,
  deleteUserRatingReview,
  listMovieComments,
  normaliseLocalComment,
  reportMovieComment,
  updateMovieComment,
  upsertRatingReview,
} from '@/lib/comments';
import { toggleCommentReaction } from '@/lib/commentReactions';
import { useAuth } from '@/lib/AuthContext';
import { cleanMovieId } from '@/lib/userInteractions';

function getMovieId(movie) {
  try {
    return movie ? cleanMovieId(movie) : null;
  } catch {
    return null;
  }
}


function applyReactionState(comments, commentId, nextReaction) {
  return comments.map(comment => {
    if (comment.id !== commentId) return comment;

    const previousReaction = comment.userReaction || null;
    let likes = Number(comment.likes || 0);
    let dislikes = Number(comment.dislikes || 0);

    if (previousReaction === 'like') likes = Math.max(0, likes - 1);
    if (previousReaction === 'dislike') dislikes = Math.max(0, dislikes - 1);
    if (nextReaction === 'like') likes += 1;
    if (nextReaction === 'dislike') dislikes += 1;

    return { ...comment, likes, dislikes, userReaction: nextReaction || null };
  });
}

function mergeCommentList(previous, nextComment) {
  if (!nextComment) return previous;

  const filtered = previous.filter(comment => {
    if (comment.id && nextComment.id && comment.id === nextComment.id) return false;
    if (nextComment.isRatingReview && comment.isRatingReview && comment.userId === nextComment.userId) return false;
    return true;
  });

  return [nextComment, ...filtered];
}

export default function useComments(movie) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const movieId = getMovieId(movie);

  const refreshComments = useCallback(async () => {
    if (!movieId) {
      setComments([]);
      return [];
    }

    setLoading(true);
    setError('');

    try {
      const rows = await listMovieComments(movieId, user?.id || null, user?.name || '', user?.avatarUrl || '');
      setComments(rows);
      return rows;
    } catch (err) {
      setError(err.message || 'Could not load comments.');
      setComments([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [movieId, user?.id, user?.name, user?.avatarUrl]);

  useEffect(() => {
    refreshComments();
  }, [refreshComments]);

  const postComment = useCallback(async text => {
    if (!user?.id) throw new Error('Please log in before posting a comment.');

    const cleanText = String(text || '').trim();
    if (!cleanText) return null;

    setSaving(true);
    setError('');

    try {
      const row = await addMovieComment(movie, user.id, cleanText);
      const localComment = row ? normaliseLocalComment(row, user.id, user.name || 'You', user.avatarUrl || '') : null;
      setComments(previous => mergeCommentList(previous, localComment));
      return row;
    } catch (err) {
      setError(err.message || 'Could not post your comment.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [movie, refreshComments, user?.id, user?.name, user?.avatarUrl]);

  const replyToComment = useCallback(async (parentCommentId, text) => {
    if (!user?.id) throw new Error('Please log in before replying to a comment.');

    const cleanText = String(text || '').trim();
    if (!parentCommentId || !cleanText) return null;

    setSaving(true);
    setError('');

    try {
      const row = await addMovieComment(movie, user.id, cleanText, parentCommentId);
      const localComment = row ? normaliseLocalComment(row, user.id, user.name || 'You', user.avatarUrl || '') : null;
      if (localComment) setComments(previous => mergeCommentList(previous, localComment));
      await refreshComments();
      return row;
    } catch (err) {
      setError(err.message || 'Could not post your reply.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [movie, refreshComments, user?.id, user?.name, user?.avatarUrl]);

  const saveRatingReview = useCallback(async (ratingValue, text) => {
    if (!user?.id) throw new Error('Please log in before saving your review.');

    setSaving(true);
    setError('');

    try {
      const row = await upsertRatingReview(movie, user.id, ratingValue, text);
      const localComment = row ? normaliseLocalComment(row, user.id, user.name || 'You', user.avatarUrl || '') : null;
      if (localComment) setComments(previous => mergeCommentList(previous, localComment));
      return row;
    } catch (err) {
      setError(err.message || 'Could not save your review.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [movie, refreshComments, user?.id, user?.name, user?.avatarUrl]);

  const editComment = useCallback(async (commentId, text) => {
    if (!user?.id) throw new Error('Please log in before editing a comment.');

    setSaving(true);
    setError('');

    try {
      await updateMovieComment(commentId, user.id, text);
      await refreshComments();
      return true;
    } catch (err) {
      setError(err.message || 'Could not update your comment.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshComments, user?.id]);


  const removeRatingReview = useCallback(async () => {
    if (!user?.id) throw new Error('Please log in before removing your review text.');

    setSaving(true);
    setError('');

    try {
      setComments(previous => previous.filter(comment => !(comment.isRatingReview && comment.userId === user.id)));
      await deleteUserRatingReview(movieId, user.id);
      await refreshComments();
      return true;
    } catch (err) {
      setError(err.message || 'Could not remove your review text.');
      await refreshComments();
      throw err;
    } finally {
      setSaving(false);
    }
  }, [movieId, refreshComments, user?.id]);


  const reportComment = useCallback(async (commentId, reason, details = '') => {
    if (!user?.id) throw new Error('Please log in before reporting a comment.');

    setSaving(true);
    setError('');

    try {
      await reportMovieComment(commentId, user.id, reason, details);
      return true;
    } catch (err) {
      setError(err.message || 'Could not report this comment.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [user?.id]);


  const reactToComment = useCallback(async (commentId, reactionType) => {
    if (!user?.id) throw new Error('Please log in before reacting to a comment.');

    const current = comments.find(comment => comment.id === commentId);
    const previousReaction = current?.userReaction || null;
    const nextReaction = previousReaction === reactionType ? null : reactionType;

    setSaving(true);
    setError('');
    setComments(previous => applyReactionState(previous, commentId, nextReaction));

    try {
      const savedReaction = await toggleCommentReaction(commentId, user.id, reactionType);
      setComments(previous => applyReactionState(previous, commentId, savedReaction || null));
      return savedReaction;
    } catch (err) {
      setError(err.message || 'Could not save your reaction.');
      await refreshComments();
      throw err;
    } finally {
      setSaving(false);
    }
  }, [comments, refreshComments, user?.id]);

  const removeComment = useCallback(async commentId => {
    if (!user?.id) throw new Error('Please log in before deleting a comment.');

    setSaving(true);
    setError('');

    try {
      setComments(previous => previous.filter(comment => comment.id !== commentId));
      await deleteMovieComment(commentId, user.id);
      await refreshComments();
      return true;
    } catch (err) {
      setError(err.message || 'Could not delete your comment.');
      await refreshComments();
      throw err;
    } finally {
      setSaving(false);
    }
  }, [refreshComments, user?.id]);

  return {
    comments,
    loading,
    saving,
    error,
    refreshComments,
    postComment,
    saveRatingReview,
    replyToComment,
    editComment,
    removeRatingReview,
    removeComment,
    reportComment,
    reactToComment,
  };
}
