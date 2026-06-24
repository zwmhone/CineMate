'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  COMMENT_LIMIT,
  createCollectionComment,
  deleteCollectionComment,
  listCollectionComments,
  reportCollectionComment,
  setCollectionCommentReaction,
  updateCollectionComment,
} from '@/lib/collectionComments';

function sortComments(list = [], sortMode = 'newest', sortDirection = 'desc') {
  const direction = sortDirection === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (sortMode === 'liked') {
      const likeDiff = (a.likeCount || 0) - (b.likeCount || 0);
      if (likeDiff !== 0) return likeDiff * direction;
    }
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return (dateA - dateB) * direction;
  });
}

export default function useCollectionComments(collectionId, { enabled = true } = {}) {
  const { user, ready } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reactingId, setReactingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sortMode, setSortMode] = useState('newest');
  const [sortDirection, setSortDirection] = useState('desc');

  const viewerId = user?.id || '';

  const loadComments = useCallback(async () => {
    if (!enabled || !collectionId) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const rows = await listCollectionComments(collectionId, viewerId);
      setComments(rows);
    } catch (nextError) {
      setComments([]);
      setError(nextError.message || 'Could not load collection comments.');
    } finally {
      setLoading(false);
    }
  }, [collectionId, enabled, viewerId]);

  useEffect(() => {
    if (!ready) return;
    loadComments();
  }, [ready, loadComments]);

  function requireLogin(message = 'Please log in before commenting on a collection.') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cinemate:require-login', { detail: message }));
    }
  }

  function flashNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  }

  async function addComment(text, parentCommentId = null) {
    if (!viewerId) {
      requireLogin(parentCommentId ? 'Please log in before replying to a collection comment.' : 'Please log in before commenting on a collection.');
      return false;
    }

    setSaving(true);
    setNotice('');
    setError('');
    try {
      const created = await createCollectionComment(collectionId, text, viewerId, parentCommentId);
      setComments(current => [created, ...current]);
      flashNotice(parentCommentId ? 'Reply posted.' : 'Comment posted.');
      return true;
    } catch (nextError) {
      setError(nextError.message || 'Could not post your comment.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function editComment(commentId, text) {
    if (!viewerId) {
      requireLogin('Please log in before editing a collection comment.');
      return false;
    }

    setSaving(true);
    setNotice('');
    setError('');
    try {
      const updated = await updateCollectionComment(commentId, text, viewerId);
      setComments(current => current.map(comment => (
        comment.id === commentId
          ? { ...comment, ...updated, likeCount: comment.likeCount, dislikeCount: comment.dislikeCount, viewerReaction: comment.viewerReaction }
          : comment
      )));
      flashNotice('Comment updated.');
      return true;
    } catch (nextError) {
      setError(nextError.message || 'Could not update this comment.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function removeComment(commentId) {
    if (!viewerId) {
      requireLogin('Please log in before deleting a collection comment.');
      return false;
    }

    const previous = comments;
    const removeIds = new Set([commentId, ...comments.filter(comment => comment.parentId === commentId).map(comment => comment.id)]);
    setComments(current => current.filter(comment => !removeIds.has(comment.id)));
    setNotice('');
    setError('');

    try {
      await deleteCollectionComment(commentId);
      flashNotice('Comment deleted.');
      return true;
    } catch (nextError) {
      setComments(previous);
      setError(nextError.message || 'Could not delete this comment.');
      return false;
    }
  }

  async function reactToComment(commentId, reactionType) {
    if (!viewerId) {
      requireLogin('Please log in before reacting to a collection comment.');
      return false;
    }

    const currentComment = comments.find(comment => comment.id === commentId);
    if (!currentComment) return false;

    const previous = comments;
    const previousReaction = currentComment.viewerReaction;
    const nextReaction = previousReaction === reactionType ? null : reactionType;

    setReactingId(commentId);
    setError('');
    setComments(current => current.map(comment => {
      if (comment.id !== commentId) return comment;
      let likeCount = comment.likeCount || 0;
      let dislikeCount = comment.dislikeCount || 0;
      if (previousReaction === 'like') likeCount = Math.max(0, likeCount - 1);
      if (previousReaction === 'dislike') dislikeCount = Math.max(0, dislikeCount - 1);
      if (nextReaction === 'like') likeCount += 1;
      if (nextReaction === 'dislike') dislikeCount += 1;
      return { ...comment, likeCount, dislikeCount, viewerReaction: nextReaction };
    }));

    try {
      await setCollectionCommentReaction(commentId, reactionType, viewerId);
      return true;
    } catch (nextError) {
      setComments(previous);
      setError(nextError.message || 'Could not update your reaction.');
      return false;
    } finally {
      setReactingId('');
    }
  }

  async function reportComment(commentId, reason, details = '') {
    if (!viewerId) {
      requireLogin('Please log in before reporting a collection comment.');
      return false;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      await reportCollectionComment(commentId, viewerId, reason, details);
      flashNotice('Report sent to the admin team.');
      return true;
    } catch (nextError) {
      setError(nextError.message || 'Could not report this comment.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function changeSort(nextMode) {
    if (sortMode === nextMode) {
      setSortDirection(current => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortMode(nextMode);
    setSortDirection('desc');
  }

  const parentComments = useMemo(() => {
    const parents = comments.filter(comment => !comment.parentId);
    return sortComments(parents, sortMode, sortDirection);
  }, [comments, sortMode, sortDirection]);

  const repliesByParent = useMemo(() => {
    const map = new Map();
    comments.filter(comment => comment.parentId).forEach(reply => {
      const list = map.get(reply.parentId) || [];
      list.push(reply);
      map.set(reply.parentId, list);
    });
    map.forEach((list, key) => {
      map.set(key, [...list].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)));
    });
    return map;
  }, [comments]);

  return {
    comments,
    parentComments,
    repliesByParent,
    loading: loading || !ready,
    saving,
    reactingId,
    error,
    notice,
    viewerId,
    sortMode,
    sortDirection,
    maxLength: COMMENT_LIMIT,
    addComment,
    editComment,
    removeComment,
    reactToComment,
    reportComment,
    changeSort,
    refresh: loadComments,
  };
}
