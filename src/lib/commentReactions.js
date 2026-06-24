import { supabase } from '@/lib/supabaseClient';
import { createNotification } from '@/lib/notifications';

const VALID_REACTIONS = new Set(['like', 'dislike']);


async function notifyCommentOwner(commentId, actorId, reactionType) {
  if (!commentId || !actorId) return;
  const { data } = await supabase
    .from('comments')
    .select('comment_id,user_id,movie_id')
    .eq('comment_id', commentId)
    .maybeSingle();

  if (!data?.user_id || data.user_id === actorId) return;
  await createNotification({
    userId: data.user_id,
    actorId,
    type: 'movie_comment_reaction',
    entityType: 'movie',
    entityId: data.movie_id,
    metadata: { movieId: data.movie_id, commentId, reactionType },
  });
}

function normaliseReactionType(type) {
  const value = String(type || '').toLowerCase().trim();
  if (!VALID_REACTIONS.has(value)) throw new Error('Reaction must be like or dislike.');
  return value;
}

export function emptyReactionSummary(commentIds = [], currentUserId = null) {
  return new Map((commentIds || []).filter(Boolean).map(commentId => [commentId, {
    commentId,
    likes: 0,
    dislikes: 0,
    userReaction: null,
    canReact: Boolean(currentUserId),
  }]));
}

export async function listCommentReactionSummaries(commentIds = [], currentUserId = null) {
  const ids = [...new Set((commentIds || []).filter(Boolean))];
  const summaries = emptyReactionSummary(ids, currentUserId);

  if (!ids.length) return summaries;

  const { data, error } = await supabase
    .from('comment_reactions')
    .select('comment_id,user_id,reaction_type')
    .in('comment_id', ids);

  if (error) {
    if (/comment_reactions|schema cache|does not exist|not found/i.test(error.message || '')) {
      return summaries;
    }
    throw new Error(error.message);
  }

  (data || []).forEach(row => {
    const commentId = row.comment_id;
    const current = summaries.get(commentId) || {
      commentId,
      likes: 0,
      dislikes: 0,
      userReaction: null,
      canReact: Boolean(currentUserId),
    };

    if (row.reaction_type === 'like') current.likes += 1;
    if (row.reaction_type === 'dislike') current.dislikes += 1;
    if (currentUserId && row.user_id === currentUserId) current.userReaction = row.reaction_type;

    summaries.set(commentId, current);
  });

  return summaries;
}

export async function toggleCommentReaction(commentId, userId, reactionType) {
  if (!userId) throw new Error('Please log in before reacting to a comment.');
  if (!commentId) throw new Error('Comment is missing.');

  const type = normaliseReactionType(reactionType);

  const existing = await supabase
    .from('comment_reactions')
    .select('reaction_id,reaction_type')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing.error) {
    if (/comment_reactions|schema cache|does not exist|not found/i.test(existing.error.message || '')) {
      throw new Error('Comment reactions need comment_reactions.sql to be run once in Supabase.');
    }
    throw new Error(existing.error.message);
  }

  if (existing.data?.reaction_type === type) {
    const { error } = await supabase
      .from('comment_reactions')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return null;
  }

  if (existing.data?.reaction_id) {
    const { data, error } = await supabase
      .from('comment_reactions')
      .update({ reaction_type: type, updated_at: new Date().toISOString() })
      .eq('reaction_id', existing.data.reaction_id)
      .select('comment_id,reaction_type')
      .maybeSingle();

    if (error) throw new Error(error.message);
    await notifyCommentOwner(commentId, userId, type);
    return data?.reaction_type || type;
  }

  const { data, error } = await supabase
    .from('comment_reactions')
    .insert({ comment_id: commentId, user_id: userId, reaction_type: type })
    .select('comment_id,reaction_type')
    .maybeSingle();

  if (error) throw new Error(error.message);
  await notifyCommentOwner(commentId, userId, type);
  return data?.reaction_type || type;
}
