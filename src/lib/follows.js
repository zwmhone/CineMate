import { supabase } from '@/lib/supabaseClient';
import { listPublicCollectionsByUser } from '@/lib/collections';
import { createNotification } from '@/lib/notifications';

function normalisePublicProfile(row = {}) {
  return {
    id: row.user_id || '',
    userId: row.user_id || '',
    name: row.full_name || 'CineMate User',
    profileImage: row.profile_image || '',
    joinedAt: row.created_at || '',
  };
}

function normaliseFollowProfile(row = {}, meta = {}) {
  const profile = normalisePublicProfile(row);
  return {
    ...profile,
    relationshipCreatedAt: meta.relationshipCreatedAt || '',
    viewerFollows: Boolean(meta.viewerFollows),
    viewerBlocked: Boolean(meta.viewerBlocked),
  };
}

function missingFollowSetup(error) {
  return /user_follows|user_blocks|schema cache|not found|does not exist/i.test(error?.message || '');
}

async function readPublicProfile(userId) {
  let result = await supabase
    .from('public_profiles')
    .select('user_id,full_name,profile_image,created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (result.error && /public_profiles|schema cache|not found|does not exist/i.test(result.error.message || '')) {
    result = await supabase
      .from('users')
      .select('user_id,full_name,profile_image,created_at')
      .eq('user_id', userId)
      .maybeSingle();
  }

  return result;
}

async function readPublicProfiles(userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return [];

  let result = await supabase
    .from('public_profiles')
    .select('user_id,full_name,profile_image,created_at')
    .in('user_id', uniqueIds);

  if (result.error && /public_profiles|schema cache|not found|does not exist/i.test(result.error.message || '')) {
    result = await supabase
      .from('users')
      .select('user_id,full_name,profile_image,created_at')
      .in('user_id', uniqueIds);
  }

  if (result.error) throw new Error(result.error.message);
  return result.data || [];
}

async function countFollows(column, userId) {
  const { count, error } = await supabase
    .from('user_follows')
    .select('follow_id', { count: 'exact', head: true })
    .eq(column, userId);

  if (error) {
    if (missingFollowSetup(error)) {
      throw new Error('Follow feature needs user_follows.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  return count || 0;
}

export async function isFollowingUser(viewerId, targetUserId) {
  if (!viewerId || !targetUserId || viewerId === targetUserId) return false;

  const { data, error } = await supabase
    .from('user_follows')
    .select('follow_id')
    .eq('follower_id', viewerId)
    .eq('following_id', targetUserId)
    .maybeSingle();

  if (error && !/no rows|multiple/i.test(error.message || '')) {
    if (missingFollowSetup(error)) {
      throw new Error('Follow feature needs user_follows.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  return Boolean(data?.follow_id);
}

export async function isBlockedByViewer(viewerId, targetUserId) {
  if (!viewerId || !targetUserId || viewerId === targetUserId) return false;

  const { data, error } = await supabase
    .from('user_blocks')
    .select('block_id')
    .eq('blocker_id', viewerId)
    .eq('blocked_id', targetUserId)
    .maybeSingle();

  if (error && !/no rows|multiple/i.test(error.message || '')) {
    if (missingFollowSetup(error)) return false;
    throw new Error(error.message);
  }

  return Boolean(data?.block_id);
}

export async function getPublicProfileBundle(profileUserId, viewerId = null) {
  if (!profileUserId) throw new Error('User profile is missing.');

  const { data, error } = await readPublicProfile(profileUserId);
  if (error) throw new Error(error.message);
  if (!data) throw new Error('This user profile could not be found.');

  const [followers, following, viewerFollowing, targetFollowingViewer, viewerBlocked, publicCollections] = await Promise.all([
    countFollows('following_id', profileUserId),
    countFollows('follower_id', profileUserId),
    isFollowingUser(viewerId, profileUserId),
    isFollowingUser(profileUserId, viewerId),
    isBlockedByViewer(viewerId, profileUserId),
    listPublicCollectionsByUser(profileUserId),
  ]);

  return {
    profile: normalisePublicProfile(data),
    stats: {
      followers,
      following,
      publicCollections: publicCollections.length,
    },
    viewer: {
      isOwnProfile: Boolean(viewerId && viewerId === profileUserId),
      isFollowing: viewerFollowing,
      isFollowedByTarget: targetFollowingViewer,
      isBlocked: viewerBlocked,
    },
    collections: publicCollections,
  };
}

export async function followUser(profileUserId, viewerId) {
  if (!viewerId) throw new Error('Please log in before following users.');
  if (!profileUserId) throw new Error('User profile is missing.');
  if (profileUserId === viewerId) throw new Error('You cannot follow your own profile.');

  const blocked = await isBlockedByViewer(viewerId, profileUserId);
  if (blocked) throw new Error('Unblock this user before following them again.');

  const wasFollowing = await isFollowingUser(viewerId, profileUserId);

  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_id: viewerId, following_id: profileUserId });

  if (error && !/duplicate key|user_follows_unique/i.test(error.message || '')) {
    if (missingFollowSetup(error)) {
      throw new Error('Follow feature needs user_follows.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  if (!wasFollowing) {
    await createNotification({
      userId: profileUserId,
      actorId: viewerId,
      type: 'follow',
      entityType: 'user',
      entityId: viewerId,
      metadata: { userId: viewerId },
    });
  }

  return true;
}

export async function unfollowUser(profileUserId, viewerId) {
  if (!viewerId) throw new Error('Please log in before unfollowing users.');
  if (!profileUserId) throw new Error('User profile is missing.');

  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', viewerId)
    .eq('following_id', profileUserId);

  if (error) {
    if (missingFollowSetup(error)) {
      throw new Error('Follow feature needs user_follows.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  return true;
}

export async function toggleFollowUser(profileUserId, viewerId, currentlyFollowing = false) {
  if (currentlyFollowing) return unfollowUser(profileUserId, viewerId);
  return followUser(profileUserId, viewerId);
}

export async function blockUser(profileUserId, viewerId) {
  if (!viewerId) throw new Error('Please log in before blocking users.');
  if (!profileUserId) throw new Error('User profile is missing.');
  if (profileUserId === viewerId) throw new Error('You cannot block your own profile.');

  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: viewerId, blocked_id: profileUserId });

  if (error && !/duplicate key|user_blocks_unique/i.test(error.message || '')) {
    if (missingFollowSetup(error)) {
      throw new Error('Follow feature needs user_follows.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  await Promise.all([
    supabase.from('user_follows').delete().eq('follower_id', viewerId).eq('following_id', profileUserId),
    supabase.from('user_follows').delete().eq('follower_id', profileUserId).eq('following_id', viewerId),
  ]);

  return true;
}

export async function unblockUser(profileUserId, viewerId) {
  if (!viewerId) throw new Error('Please log in before unblocking users.');
  if (!profileUserId) throw new Error('User profile is missing.');

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', viewerId)
    .eq('blocked_id', profileUserId);

  if (error) {
    if (missingFollowSetup(error)) {
      throw new Error('Follow feature needs user_follows.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  return true;
}

async function readViewerFollowMap(viewerId, userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean).filter(id => id !== viewerId))];
  if (!viewerId || !uniqueIds.length) return new Set();

  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', viewerId)
    .in('following_id', uniqueIds);

  if (error) {
    if (missingFollowSetup(error)) return new Set();
    throw new Error(error.message);
  }

  return new Set((data || []).map(row => row.following_id));
}

async function readViewerBlockMap(viewerId, userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean).filter(id => id !== viewerId))];
  if (!viewerId || !uniqueIds.length) return new Set();

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', viewerId)
    .in('blocked_id', uniqueIds);

  if (error) {
    if (missingFollowSetup(error)) return new Set();
    throw new Error(error.message);
  }

  return new Set((data || []).map(row => row.blocked_id));
}

export async function listFollowProfiles(profileUserId, listType = 'followers', viewerId = null) {
  if (!profileUserId) throw new Error('User profile is missing.');
  const mode = listType === 'following' ? 'following' : 'followers';

  const selectColumn = mode === 'followers' ? 'follower_id' : 'following_id';
  const filterColumn = mode === 'followers' ? 'following_id' : 'follower_id';

  const { data, error } = await supabase
    .from('user_follows')
    .select(`${selectColumn},created_at`)
    .eq(filterColumn, profileUserId)
    .order('created_at', { ascending: false });

  if (error) {
    if (missingFollowSetup(error)) {
      throw new Error('Follow feature needs user_follows.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  const rows = data || [];
  const ids = rows.map(row => row[selectColumn]).filter(Boolean);
  if (!ids.length) return [];

  const [profiles, viewerFollows, viewerBlocks] = await Promise.all([
    readPublicProfiles(ids),
    readViewerFollowMap(viewerId, ids),
    readViewerBlockMap(viewerId, ids),
  ]);

  const rowByUserId = new Map(rows.map(row => [row[selectColumn], row]));
  const order = new Map(ids.map((id, index) => [id, index]));

  return profiles
    .sort((a, b) => (order.get(a.user_id) || 0) - (order.get(b.user_id) || 0))
    .map(profile => normaliseFollowProfile(profile, {
      relationshipCreatedAt: rowByUserId.get(profile.user_id)?.created_at || '',
      viewerFollows: viewerFollows.has(profile.user_id),
      viewerBlocked: viewerBlocks.has(profile.user_id),
    }));
}


export async function listBlockedProfiles(viewerId) {
  if (!viewerId) return [];

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id,created_at')
    .eq('blocker_id', viewerId)
    .order('created_at', { ascending: false });

  if (error) {
    if (missingFollowSetup(error)) {
      throw new Error('Block feature needs user_follows.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  const rows = data || [];
  const ids = rows.map(row => row.blocked_id).filter(Boolean);
  if (!ids.length) return [];

  const profiles = await readPublicProfiles(ids);
  const rowByUserId = new Map(rows.map(row => [row.blocked_id, row]));
  const order = new Map(ids.map((id, index) => [id, index]));

  return profiles
    .sort((a, b) => (order.get(a.user_id) || 0) - (order.get(b.user_id) || 0))
    .map(profile => normaliseFollowProfile(profile, {
      relationshipCreatedAt: rowByUserId.get(profile.user_id)?.created_at || '',
      viewerFollows: false,
      viewerBlocked: true,
    }));
}
