import { supabase } from '@/lib/supabaseClient';
import { createNotification } from '@/lib/notifications';

const COMMENT_LIMIT = 2000;

function cleanText(value = '') {
  return String(value || '').trim();
}

function profileInitial(name = '') {
  return cleanText(name || 'CineMate User').charAt(0).toUpperCase() || 'C';
}

function formatDate(value = '') {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}

function normaliseProfile(row = {}) {
  const name = row?.full_name || row?.email?.split('@')[0] || 'CineMate User';
  return {
    id: row?.user_id || '',
    name,
    email: row?.email || '',
    profileImage: row?.profile_image || '',
    initial: profileInitial(name),
  };
}

function normaliseComment(row = {}, profile = {}, reactionSummary = {}) {
  return {
    id: row?.collection_comment_id || '',
    collectionId: row?.collection_id || '',
    userId: row?.user_id || '',
    parentId: row?.parent_comment_id || null,
    text: row?.comment_text || '',
    createdAt: row?.created_at || '',
    updatedAt: row?.updated_at || row?.created_at || '',
    editedAt: row?.edited_at || '',
    dateLabel: formatDate(row?.created_at || row?.updated_at),
    isEdited: Boolean(row?.edited_at),
    profile: normaliseProfile({ user_id: row?.user_id, ...profile }),
    likeCount: reactionSummary.likeCount || 0,
    dislikeCount: reactionSummary.dislikeCount || 0,
    viewerReaction: reactionSummary.viewerReaction || null,
  };
}

async function getProfiles(userIds = []) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('users')
    .select('user_id,full_name,email,profile_image')
    .in('user_id', ids);

  if (error) return new Map();
  return new Map((data || []).map(profile => [profile.user_id, profile]));
}

async function getReactionSummary(commentIds = [], viewerId = '') {
  const ids = [...new Set(commentIds.filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('collection_comment_reactions')
    .select('collection_comment_id,user_id,reaction_type')
    .in('collection_comment_id', ids);

  if (error) {
    if (/collection_comment_reactions|schema cache|does not exist|not found/i.test(error.message || '')) {
      throw new Error('Collection comment reactions need collection_comments.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  const map = new Map(ids.map(id => [id, { likeCount: 0, dislikeCount: 0, viewerReaction: null }]));
  (data || []).forEach(row => {
    const summary = map.get(row.collection_comment_id) || { likeCount: 0, dislikeCount: 0, viewerReaction: null };
    if (row.reaction_type === 'like') summary.likeCount += 1;
    if (row.reaction_type === 'dislike') summary.dislikeCount += 1;
    if (viewerId && row.user_id === viewerId) summary.viewerReaction = row.reaction_type;
    map.set(row.collection_comment_id, summary);
  });

  return map;
}

export async function listCollectionComments(collectionId, viewerId = '') {
  if (!collectionId) return [];

  const { data, error } = await supabase
    .from('collection_comments')
    .select('collection_comment_id,collection_id,user_id,parent_comment_id,comment_text,created_at,updated_at,edited_at,is_hidden')
    .eq('collection_id', collectionId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });

  if (error) {
    if (/collection_comments|schema cache|does not exist|not found/i.test(error.message || '')) {
      throw new Error('Collection comments need collection_comments.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  const rows = data || [];
  const profileMap = await getProfiles(rows.map(row => row.user_id));
  const reactionMap = await getReactionSummary(rows.map(row => row.collection_comment_id), viewerId);
  return rows.map(row => normaliseComment(row, profileMap.get(row.user_id), reactionMap.get(row.collection_comment_id)));
}


async function getCollectionCommentContext(collectionId, parentCommentId = null) {
  const context = {
    collectionOwnerId: '',
    collectionTitle: '',
    parentUserId: '',
  };

  if (collectionId) {
    const { data } = await supabase
      .from('collections')
      .select('collection_id,user_id,title')
      .eq('collection_id', collectionId)
      .maybeSingle();
    context.collectionOwnerId = data?.user_id || '';
    context.collectionTitle = data?.title || '';
  }

  if (parentCommentId) {
    const { data } = await supabase
      .from('collection_comments')
      .select('collection_comment_id,user_id')
      .eq('collection_comment_id', parentCommentId)
      .maybeSingle();
    context.parentUserId = data?.user_id || '';
  }

  return context;
}

async function notifyCollectionCommentActivity({ collectionId, commentId, actorId, parentCommentId = null }) {
  if (!collectionId || !commentId || !actorId) return;
  const context = await getCollectionCommentContext(collectionId, parentCommentId);

  if (parentCommentId && context.parentUserId && context.parentUserId !== actorId) {
    await createNotification({
      userId: context.parentUserId,
      actorId,
      type: 'collection_comment_reply',
      entityType: 'collection',
      entityId: collectionId,
      metadata: {
        collectionId,
        collectionTitle: context.collectionTitle,
        commentId,
        parentCommentId,
      },
    });
    return;
  }

  if (!parentCommentId && context.collectionOwnerId && context.collectionOwnerId !== actorId) {
    await createNotification({
      userId: context.collectionOwnerId,
      actorId,
      type: 'collection_comment',
      entityType: 'collection',
      entityId: collectionId,
      metadata: {
        collectionId,
        collectionTitle: context.collectionTitle,
        commentId,
      },
    });
  }
}

async function notifyCollectionCommentReaction(commentId, actorId, reactionType) {
  if (!commentId || !actorId) return;
  const { data } = await supabase
    .from('collection_comments')
    .select('collection_comment_id,collection_id,user_id')
    .eq('collection_comment_id', commentId)
    .maybeSingle();

  if (!data?.user_id || data.user_id === actorId) return;
  const context = await getCollectionCommentContext(data.collection_id);
  await createNotification({
    userId: data.user_id,
    actorId,
    type: 'collection_comment_reaction',
    entityType: 'collection',
    entityId: data.collection_id,
    metadata: {
      collectionId: data.collection_id,
      collectionTitle: context.collectionTitle,
      commentId,
      reactionType,
    },
  });
}

export async function createCollectionComment(collectionId, text, userId, parentCommentId = null) {
  if (!userId) throw new Error('Please log in before commenting on a collection.');
  if (!collectionId) throw new Error('Collection is missing.');

  const cleanComment = cleanText(text);
  if (!cleanComment) throw new Error('Please write a comment first.');
  if (cleanComment.length > COMMENT_LIMIT) throw new Error(`Collection comments must be ${COMMENT_LIMIT} characters or fewer.`);

  if (parentCommentId) {
    const { data: parent, error: parentError } = await supabase
      .from('collection_comments')
      .select('collection_comment_id,collection_id')
      .eq('collection_comment_id', parentCommentId)
      .maybeSingle();

    if (parentError) throw new Error(parentError.message);
    if (!parent || parent.collection_id !== collectionId) {
      throw new Error('Could not reply because the parent comment was not found in this collection.');
    }
  }

  const { data, error } = await supabase
    .from('collection_comments')
    .insert({
      collection_id: collectionId,
      user_id: userId,
      parent_comment_id: parentCommentId || null,
      comment_text: cleanComment,
    })
    .select('collection_comment_id,collection_id,user_id,parent_comment_id,comment_text,created_at,updated_at,edited_at')
    .single();

  if (error) throw new Error(error.message);

  await notifyCollectionCommentActivity({
    collectionId,
    commentId: data.collection_comment_id,
    actorId: userId,
    parentCommentId: parentCommentId || null,
  });

  const profileMap = await getProfiles([userId]);
  return normaliseComment(data, profileMap.get(userId), { likeCount: 0, dislikeCount: 0, viewerReaction: null });
}

export async function updateCollectionComment(commentId, text, userId) {
  if (!userId) throw new Error('Please log in before editing a comment.');
  if (!commentId) throw new Error('Comment is missing.');

  const cleanComment = cleanText(text);
  if (!cleanComment) throw new Error('Please write a comment first.');
  if (cleanComment.length > COMMENT_LIMIT) throw new Error(`Collection comments must be ${COMMENT_LIMIT} characters or fewer.`);

  const { data, error } = await supabase
    .from('collection_comments')
    .update({
      comment_text: cleanComment,
      updated_at: new Date().toISOString(),
      edited_at: new Date().toISOString(),
    })
    .eq('collection_comment_id', commentId)
    .eq('user_id', userId)
    .select('collection_comment_id,collection_id,user_id,parent_comment_id,comment_text,created_at,updated_at,edited_at')
    .single();

  if (error) throw new Error(error.message);

  const profileMap = await getProfiles([userId]);
  return normaliseComment(data, profileMap.get(userId));
}

export async function deleteCollectionComment(commentId) {
  if (!commentId) throw new Error('Comment is missing.');

  const { error } = await supabase
    .from('collection_comments')
    .delete()
    .eq('collection_comment_id', commentId);

  if (error) throw new Error(error.message);
  return true;
}

export async function setCollectionCommentReaction(commentId, reactionType, userId) {
  if (!userId) throw new Error('Please log in before reacting to a collection comment.');
  if (!commentId) throw new Error('Comment is missing.');
  if (!['like', 'dislike'].includes(reactionType)) throw new Error('Reaction is invalid.');

  const { data: existing, error: lookupError } = await supabase
    .from('collection_comment_reactions')
    .select('reaction_id,reaction_type')
    .eq('collection_comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  if (existing?.reaction_type === reactionType) {
    const { error } = await supabase
      .from('collection_comment_reactions')
      .delete()
      .eq('reaction_id', existing.reaction_id);
    if (error) throw new Error(error.message);
    return null;
  }

  if (existing?.reaction_id) {
    const { error } = await supabase
      .from('collection_comment_reactions')
      .update({ reaction_type: reactionType, updated_at: new Date().toISOString() })
      .eq('reaction_id', existing.reaction_id);
    if (error) throw new Error(error.message);
    await notifyCollectionCommentReaction(commentId, userId, reactionType);
    return reactionType;
  }

  const { error } = await supabase
    .from('collection_comment_reactions')
    .insert({
      collection_comment_id: commentId,
      user_id: userId,
      reaction_type: reactionType,
    });

  if (error) throw new Error(error.message);
  await notifyCollectionCommentReaction(commentId, userId, reactionType);
  return reactionType;
}

export async function reportCollectionComment(commentId, userId, reason = 'Inappropriate collection comment', details = '') {
  if (!userId) throw new Error('Please log in before reporting a comment.');
  if (!commentId) throw new Error('Comment is missing.');

  const cleanReason = cleanText(reason) || 'Inappropriate collection comment';
  const cleanDetails = cleanText(details);

  const { data: commentContext } = await supabase
    .from('collection_comments')
    .select('collection_comment_id,collection_id,user_id')
    .eq('collection_comment_id', commentId)
    .maybeSingle();

  const { error } = await supabase
    .from('collection_comment_reports')
    .upsert({
      collection_comment_id: commentId,
      reporter_id: userId,
      reason: cleanReason,
      details: cleanDetails || null,
      status: 'open',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'collection_comment_id,reporter_id' });

  if (error) {
    if (/collection_comment_reports|schema cache|does not exist|not found/i.test(error.message || '')) {
      throw new Error('Collection comment reports need collection_comments.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  if (commentContext?.user_id && commentContext.user_id !== userId) {
    const context = await getCollectionCommentContext(commentContext.collection_id);
    await createNotification({
      userId: commentContext.user_id,
      actorId: null,
      type: 'collection_comment_reported',
      entityType: 'collection',
      entityId: commentContext.collection_id,
      metadata: {
        collectionId: commentContext.collection_id,
        collectionTitle: context.collectionTitle,
        commentId,
      },
    });
  }

  return true;
}

export { COMMENT_LIMIT };
