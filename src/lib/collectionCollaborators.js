import { supabase } from '@/lib/supabaseClient';
import { createNotification } from '@/lib/notifications';

function normaliseProfile(row = {}) {
  return {
    id: row?.user_id || '',
    userId: row?.user_id || '',
    name: row?.full_name || row?.email?.split?.('@')?.[0] || 'CineMate User',
    email: row?.email || '',
    profileImage: row?.profile_image || '',
    joinedAt: row?.created_at || '',
  };
}

function normaliseCollaborator(row = {}, profile = null) {
  const user = normaliseProfile(profile || row?.profile || {});
  return {
    id: row?.collaboration_id || row?.user_id || user.id,
    collaborationId: row?.collaboration_id || '',
    collectionId: row?.collection_id || '',
    userId: row?.user_id || user.id,
    addedBy: row?.added_by || '',
    role: row?.role || 'editor',
    status: row?.status || 'accepted',
    isPending: row?.status === 'pending',
    isAccepted: (row?.status || 'accepted') === 'accepted',
    createdAt: row?.created_at || '',
    acceptedAt: row?.accepted_at || '',
    user,
  };
}

function missingSetup(error) {
  return /collection_collaborators|collection_invites|create_collection_invite|accept_collection_invite|schema cache|not found|does not exist|relation|function/i.test(error?.message || '');
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
      .select('user_id,full_name,profile_image,created_at,email')
      .in('user_id', uniqueIds);
  }

  if (result.error) throw new Error(result.error.message);
  return result.data || [];
}

async function readCollectionOwner(collectionId) {
  const { data, error } = await supabase
    .from('collections')
    .select('collection_id,user_id,title')
    .eq('collection_id', collectionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Collection was not found.');
  return data;
}

export async function listCollectionCollaborators(collectionId) {
  if (!collectionId) return [];

  const { data, error } = await supabase
    .from('collection_collaborators')
    .select('collaboration_id,collection_id,user_id,added_by,role,status,created_at,accepted_at')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: false });

  if (error) {
    if (missingSetup(error)) throw new Error('Collection collaboration needs collection_collaborators.sql to be run once in Supabase.');
    throw new Error(error.message);
  }

  const rows = data || [];
  const profiles = await readPublicProfiles(rows.map(row => row.user_id));
  const profileById = new Map(profiles.map(profile => [profile.user_id, profile]));

  return rows.map(row => normaliseCollaborator(row, profileById.get(row.user_id)));
}

export async function listCollaborationCandidates(collectionId, ownerId) {
  if (!collectionId || !ownerId) return [];

  const [collection, collaborators] = await Promise.all([
    readCollectionOwner(collectionId),
    listCollectionCollaborators(collectionId).catch(error => {
      if (/collection_collaborators\.sql/i.test(error.message || '')) throw error;
      return [];
    }),
  ]);

  if (collection.user_id !== ownerId) throw new Error('Only the collection creator can invite collaborators.');

  const { data, error } = await supabase
    .from('user_follows')
    .select('follower_id,following_id,created_at')
    .or(`follower_id.eq.${ownerId},following_id.eq.${ownerId}`)
    .order('created_at', { ascending: false });

  if (error) {
    if (/user_follows|schema cache|not found|does not exist/i.test(error.message || '')) {
      throw new Error('Invite suggestions need user_follows.sql to be run once in Supabase.');
    }
    throw new Error(error.message);
  }

  const collaboratorIds = new Set(collaborators.map(item => item.userId));
  const relationshipByUserId = new Map();

  (data || []).forEach(row => {
    const otherId = row.follower_id === ownerId ? row.following_id : row.follower_id;
    if (!otherId || otherId === ownerId || collaboratorIds.has(otherId)) return;
    const existing = relationshipByUserId.get(otherId) || { followsYou: false, followedByYou: false };
    if (row.following_id === ownerId) existing.followsYou = true;
    if (row.follower_id === ownerId) existing.followedByYou = true;
    relationshipByUserId.set(otherId, existing);
  });

  const ids = [...relationshipByUserId.keys()];
  const profiles = await readPublicProfiles(ids);

  return profiles.map(profile => {
    const relationship = relationshipByUserId.get(profile.user_id) || {};
    const label = relationship.followsYou && relationship.followedByYou
      ? 'Mutual follow'
      : relationship.followedByYou
        ? 'Following'
        : 'Follower';

    return {
      ...normaliseProfile(profile),
      relationshipLabel: label,
      followsYou: Boolean(relationship.followsYou),
      followedByYou: Boolean(relationship.followedByYou),
    };
  });
}

export async function addCollectionCollaborator(collectionId, targetUserId, ownerId) {
  if (!ownerId) throw new Error('Please log in to invite collaborators.');
  if (!collectionId) throw new Error('Collection is missing.');
  if (!targetUserId) throw new Error('Choose a user to invite.');
  if (targetUserId === ownerId) throw new Error('You already own this collection.');

  const { data: existingInvite } = await supabase
    .from('collection_collaborators')
    .select('collaboration_id,status')
    .eq('collection_id', collectionId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  const { error } = await supabase
    .from('collection_collaborators')
    .insert({
      collection_id: collectionId,
      user_id: targetUserId,
      added_by: ownerId,
      role: 'editor',
      status: 'pending',
    });

  if (error && !/duplicate key|collection_collaborators_unique/i.test(error.message || '')) {
    if (missingSetup(error)) throw new Error('Collection collaboration needs collection_collaborators.sql to be run once in Supabase.');
    throw new Error(error.message);
  }

  if (!existingInvite?.collaboration_id) {
    const collection = await readCollectionOwner(collectionId).catch(() => null);
    await createNotification({
      userId: targetUserId,
      actorId: ownerId,
      type: 'collection_invite',
      entityType: 'collection',
      entityId: collectionId,
      metadata: { collectionId, collectionTitle: collection?.title || '' },
    });
  }

  return 'pending';
}

export async function acceptPendingCollectionCollaboration(collectionId, userId) {
  if (!userId) throw new Error('Please log in to accept this collaboration invite.');
  if (!collectionId) throw new Error('Collection is missing.');

  const { data, error } = await supabase.rpc('accept_pending_collection_collaboration', {
    target_collection_id: collectionId,
  });

  if (error) {
    if (missingSetup(error)) throw new Error('Collection collaboration needs collection_collaborators.sql to be run once in Supabase.');
    throw new Error(error.message);
  }

  const collection = await readCollectionOwner(collectionId).catch(() => null);
  if (collection?.user_id && collection.user_id !== userId) {
    await createNotification({
      userId: collection.user_id,
      actorId: userId,
      type: 'collection_invite_accepted',
      entityType: 'collection',
      entityId: collectionId,
      metadata: { collectionId, collectionTitle: collection.title || '' },
    });
  }

  return data || 'accepted';
}

export async function declinePendingCollectionCollaboration(collectionId, userId) {
  if (!userId) throw new Error('Please log in to decline this collaboration invite.');
  if (!collectionId) throw new Error('Collection is missing.');

  const { data, error } = await supabase.rpc('decline_pending_collection_collaboration', {
    target_collection_id: collectionId,
  });

  if (error) {
    if (missingSetup(error)) throw new Error('Collection collaboration needs collection_collaborators.sql to be run once in Supabase.');
    throw new Error(error.message);
  }

  return data || 'declined';
}

export async function removeCollectionCollaborator(collectionId, targetUserId, actorId) {
  if (!actorId) throw new Error('Please log in to manage collaborators.');
  if (!collectionId || !targetUserId) throw new Error('Collaborator is missing.');

  const [collection, collaboratorResult] = await Promise.all([
    readCollectionOwner(collectionId).catch(() => null),
    supabase
      .from('collection_collaborators')
      .select('collaboration_id,user_id,status')
      .eq('collection_id', collectionId)
      .eq('user_id', targetUserId)
      .maybeSingle(),
  ]);

  if (collaboratorResult.error && !/no rows/i.test(collaboratorResult.error.message || '')) {
    if (missingSetup(collaboratorResult.error)) throw new Error('Collection collaboration needs collection_collaborators.sql to be run once in Supabase.');
    throw new Error(collaboratorResult.error.message);
  }

  const { error } = await supabase
    .from('collection_collaborators')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', targetUserId);

  if (error) {
    if (missingSetup(error)) throw new Error('Collection collaboration needs collection_collaborators.sql to be run once in Supabase.');
    throw new Error(error.message);
  }

  const title = collection?.title || '';
  if (targetUserId === actorId) {
    if (collection?.user_id && collection.user_id !== actorId && collaboratorResult.data?.collaboration_id) {
      await createNotification({
        userId: collection.user_id,
        actorId,
        type: 'collection_collaborator_left',
        entityType: 'collection',
        entityId: collectionId,
        metadata: { collectionId, collectionTitle: title },
      });
    }
  } else if (collaboratorResult.data?.collaboration_id) {
    await createNotification({
      userId: targetUserId,
      actorId,
      type: 'collection_collaborator_removed',
      entityType: 'collection',
      entityId: collectionId,
      metadata: {
        collectionId,
        collectionTitle: title,
        previousStatus: collaboratorResult.data.status || 'accepted',
      },
    });
  }

  return true;
}

export async function getCollectionInvitePreview(collectionId, inviteToken) {
  if (!collectionId || !inviteToken) return null;

  const { data, error } = await supabase.rpc('get_collection_invite_preview', {
    target_collection_id: collectionId,
    target_invite_token: inviteToken,
  });

  if (error) {
    if (missingSetup(error)) throw new Error('Invite links need collection_collaborators.sql to be run once in Supabase.');
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    id: row.collection_id || collectionId,
    collectionId: row.collection_id || collectionId,
    title: row.title || 'Untitled collection',
    description: row.description || '',
    itemCount: Number(row.item_count || 0),
    owner: {
      id: row.owner_id || '',
      name: row.owner_name || 'CineMate user',
      profileImage: row.owner_profile_image || '',
    },
  };
}


export async function createCollectionInviteLink(collectionId, ownerId) {
  if (!ownerId) throw new Error('Please log in to create an invite link.');
  if (!collectionId) throw new Error('Collection is missing.');

  const { data, error } = await supabase.rpc('create_collection_invite', {
    target_collection_id: collectionId,
  });

  if (error) {
    if (missingSetup(error)) throw new Error('Invite links need collection_collaborators.sql to be run once in Supabase.');
    throw new Error(error.message);
  }

  const token = Array.isArray(data) ? data[0] : data;
  if (!token) throw new Error('Could not create invite link.');
  return token;
}

export async function acceptCollectionInvite(collectionId, inviteToken, userId) {
  if (!userId) throw new Error('Please log in to accept this collection invite.');
  if (!collectionId || !inviteToken) throw new Error('Invite link is missing.');

  const { data, error } = await supabase.rpc('accept_collection_invite', {
    target_collection_id: collectionId,
    target_invite_token: inviteToken,
  });

  if (error) {
    if (missingSetup(error)) throw new Error('Invite links need collection_collaborators.sql to be run once in Supabase.');
    throw new Error(error.message);
  }

  const collection = await readCollectionOwner(collectionId).catch(() => null);
  if (collection?.user_id && collection.user_id !== userId && data === 'accepted') {
    await createNotification({
      userId: collection.user_id,
      actorId: userId,
      type: 'collection_invite_accepted',
      entityType: 'collection',
      entityId: collectionId,
      metadata: { collectionId, collectionTitle: collection.title || '' },
    });
  }

  return data || 'accepted';
}
