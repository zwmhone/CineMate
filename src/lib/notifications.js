import { supabase } from '@/lib/supabaseClient';

const MISSING_SETUP_PATTERN = /notifications|schema cache|not found|does not exist|relation/i;

function cleanText(value = '') {
  return String(value || '').trim();
}

function missingNotificationsSetup(error) {
  return MISSING_SETUP_PATTERN.test(error?.message || '');
}

function profileInitial(name = '') {
  return cleanText(name || 'CineMate User').charAt(0).toUpperCase() || 'C';
}

function formatTime(value = '') {
  if (!value) return '';
  try {
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return 'just now';
    if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
  } catch {
    return '';
  }
}

function normaliseActor(row = {}) {
  const name = row?.full_name || row?.email?.split?.('@')?.[0] || 'CineMate User';
  return {
    id: row?.user_id || '',
    name,
    profileImage: row?.profile_image || '',
    initial: profileInitial(name),
  };
}


function anonymousActor() {
  return {
    id: '',
    name: 'Anonymous reporter',
    profileImage: '',
    initial: '!',
    isAnonymous: true,
  };
}

function isAnonymousNotification(row = {}) {
  const type = String(row.type || '').toLowerCase();
  return type === 'movie_comment_reported'
    || type === 'collection_comment_reported'
    || (type.includes('comment') && type.includes('reported'));
}

function metadataTitle(metadata = {}) {
  return cleanText(metadata.collectionTitle || metadata.movieTitle || metadata.title || metadata.itemTitle || '');
}

function detailLinkFromId(value, mediaType = '') {
  const id = Number(value);
  if (!Number.isFinite(id)) return value ? `/movie/${value}` : '/dashboard';
  const isTv = mediaType === 'tv' || id < 0;
  return isTv ? `/movie/${Math.abs(id)}?type=tv` : `/movie/${id}`;
}

function actionLink(row = {}, metadata = {}) {
  const entityId = cleanText(row.entity_id);
  const mediaType = cleanText(metadata.mediaType || metadata.media_type || row.entity_type).toLowerCase();
  if (row.type === 'follow') return row.actor_id ? `/users/${row.actor_id}` : '/';
  if (row.type === 'collection_collaborator_removed') return '/dashboard';
  if (row.type === 'moderation_warning' || row.type === 'moderation_ban') return '#moderation-warning';
  if (row.entity_type === 'collection' && entityId) return `/collections/${entityId}`;
  if ((row.entity_type === 'movie' || row.entity_type === 'tv') && entityId) return detailLinkFromId(entityId, mediaType);
  if (metadata.collectionId) return `/collections/${metadata.collectionId}`;
  if (metadata.movieId) return detailLinkFromId(metadata.movieId, mediaType);
  if (metadata.userId) return `/users/${metadata.userId}`;
  return '/dashboard';
}

function buildMessage(row = {}, actor = {}) {
  const metadata = row.metadata || {};
  const actorName = actor?.name || 'Someone';
  const title = metadataTitle(metadata);

  switch (row.type) {
    case 'follow':
      return `${actorName} followed you.`;
    case 'movie_comment_reply':
      return `${actorName} replied to your movie comment${title ? ` on ${title}` : ''}.`;
    case 'movie_comment_reaction':
      return `${actorName} ${metadata.reactionType === 'dislike' ? 'disliked' : 'liked'} your movie comment${title ? ` on ${title}` : ''}.`;
    case 'collection_comment':
      return `${actorName} commented on your collection${title ? ` “${title}”` : ''}.`;
    case 'collection_comment_reply':
      return `${actorName} replied to your collection comment${title ? ` in “${title}”` : ''}.`;
    case 'collection_comment_reaction':
      return `${actorName} ${metadata.reactionType === 'dislike' ? 'disliked' : 'liked'} your collection comment${title ? ` in “${title}”` : ''}.`;
    case 'collection_invite':
      return `${actorName} invited you to collaborate on${title ? ` “${title}”` : ' a collection'}.`;
    case 'collection_invite_accepted':
      return `${actorName} accepted your invite${title ? ` for “${title}”` : ''}.`;
    case 'collection_collaborator_left':
      return `${actorName} left${title ? ` your collection “${title}”` : ' your collection collaboration'}.`;
    case 'collection_collaborator_removed':
      return `You have been removed from${title ? ` “${title}”` : ' a collection collaboration'}.`;
    case 'movie_comment_reported':
      return `Your movie comment${title ? ` on ${title}` : ''} has been reported.`;
    case 'collection_comment_reported':
      return `Your collection comment${title ? ` in “${title}”` : ''} has been reported.`;
    case 'collection_title_added':
      return `${actorName} added ${metadata.itemTitle ? `“${metadata.itemTitle}”` : 'a title'} to${title ? ` “${title}”` : ' your collection'}.`;
    case 'moderation_warning':
      if (Number(metadata.strikeNumber || 1) >= 3 || metadata.finalWarning) return 'You received a final moderation warning. One more serious violation may ban your account.';
      return `You received a moderation warning (${metadata.strikeNumber || 1}/${metadata.maxStrikes || 3}).`;
    case 'moderation_ban':
      return 'Your account has been banned after 3 moderation warnings and a final warning.';
    default:
      return `${actorName} has new activity for you.`;
  }
}

function normaliseNotification(row = {}, actorMap = new Map()) {
  const actor = isAnonymousNotification(row) ? anonymousActor() : normaliseActor(actorMap.get(row.actor_id) || { user_id: row.actor_id });
  return {
    id: row.notification_id,
    userId: row.user_id,
    actorId: row.actor_id,
    type: row.type,
    entityType: row.entity_type || '',
    entityId: row.entity_id || '',
    metadata: row.metadata || {},
    isRead: Boolean(row.is_read),
    createdAt: row.created_at || '',
    timeLabel: formatTime(row.created_at),
    actor,
    message: buildMessage(row, actor),
    href: actionLink(row, row.metadata || {}),
  };
}

async function readPublicProfiles(userIds = []) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();

  let result = await supabase
    .from('public_profiles')
    .select('user_id,full_name,profile_image,created_at')
    .in('user_id', ids);

  if (result.error && /public_profiles|schema cache|not found|does not exist/i.test(result.error.message || '')) {
    result = await supabase
      .from('users')
      .select('user_id,full_name,email,profile_image')
      .in('user_id', ids);
  }

  if (result.error) return new Map();
  return new Map((result.data || []).map(profile => [profile.user_id, profile]));
}

export async function createNotification({ userId, actorId, type, entityType = '', entityId = '', metadata = {} } = {}) {
  if (!userId || !type) return false;
  if (actorId && userId === actorId && !String(type).includes('reported') && !String(type).includes('moderation')) return false;

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      actor_id: actorId,
      type,
      entity_type: entityType || null,
      entity_id: entityId ? String(entityId) : null,
      metadata: metadata || {},
    });

  if (error) {
    if (missingNotificationsSetup(error)) return false;
    console.warn('Notification could not be created:', error.message);
    return false;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cinemate:notifications-refresh'));
  }
  return true;
}

export async function listNotifications(userId, limit = 20) {
  if (!userId) return { items: [], unreadCount: 0 };

  const { data, error } = await supabase
    .from('notifications')
    .select('notification_id,user_id,actor_id,type,entity_type,entity_id,metadata,is_read,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (missingNotificationsSetup(error)) {
      return { items: [], unreadCount: 0, setupMissing: true };
    }
    throw new Error(error.message);
  }

  const rows = data || [];
  const actorMap = await readPublicProfiles(rows.filter(row => !isAnonymousNotification(row)).map(row => row.actor_id));

  const { count, error: countError } = await supabase
    .from('notifications')
    .select('notification_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return {
    items: rows.map(row => normaliseNotification(row, actorMap)),
    unreadCount: countError ? rows.filter(row => !row.is_read).length : (count || 0),
  };
}

export async function markNotificationRead(notificationId, userId) {
  if (!notificationId || !userId) return false;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq('notification_id', notificationId)
    .eq('user_id', userId);

  if (error) {
    if (missingNotificationsSetup(error)) return false;
    throw new Error(error.message);
  }
  return true;
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return false;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    if (missingNotificationsSetup(error)) return false;
    throw new Error(error.message);
  }
  return true;
}

export async function listUnreadModerationAlerts(userId, limit = 5) {
  if (!userId) return { items: [], setupMissing: false };

  const { data, error } = await supabase
    .from('notifications')
    .select('notification_id,user_id,actor_id,type,entity_type,entity_id,metadata,is_read,created_at,updated_at')
    .eq('user_id', userId)
    .eq('is_read', false)
    .in('type', ['moderation_warning', 'moderation_ban'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (missingNotificationsSetup(error)) return { items: [], setupMissing: true };
    throw new Error(error.message);
  }

  const rows = data || [];
  const actorMap = await readPublicProfiles(rows.filter(row => !isAnonymousNotification(row)).map(row => row.actor_id));
  return { items: rows.map(row => normaliseNotification(row, actorMap)), setupMissing: false };
}
