import { supabase } from '@/lib/supabaseClient';
import { cleanMovieId, ensureMovieExists, isDuplicateError } from '@/lib/userInteractions';
import { createNotification } from '@/lib/notifications';

const COLLECTION_SELECT = `
  collection_id,
  user_id,
  title,
  description,
  is_public,
  created_at,
  updated_at
`;

const COLLECTION_ITEM_SELECT = `
  item_id,
  collection_id,
  movie_id,
  added_at,
  movies(movie_id,title,poster_url,genres,overview,release_date,tmdb_rating,runtime)
`;

const COLLECTION_ITEMS_WITH_MOVIE_SELECT = `
  item_id,
  collection_id,
  movie_id,
  added_at,
  movies(movie_id,title,poster_url,genres,overview,release_date,tmdb_rating,runtime)
`;

function safeText(value = '') {
  return String(value || '').trim();
}

function publicTmdbIdFromStoredId(movieId) {
  const value = Number(movieId);
  return Number.isFinite(value) ? Math.abs(value) : movieId;
}

function mediaTypeFromStoredId(movieId) {
  const value = Number(movieId);
  return Number.isFinite(value) && value < 0 ? 'tv' : 'movie';
}

function normalizeMovie(row = {}, fallbackMovieId = null) {
  const storedMovieId = row?.movie_id || fallbackMovieId;
  const mediaType = mediaTypeFromStoredId(storedMovieId);
  const tmdbId = publicTmdbIdFromStoredId(storedMovieId);
  return {
    id: tmdbId,
    tmdbId,
    dbMovieId: storedMovieId,
    mediaType,
    title: row?.title || `${mediaType === 'tv' ? 'TV Show' : 'Movie'} ${tmdbId}`,
    genre: row?.genres || (mediaType === 'tv' ? 'TV Show' : 'Movie'),
    tags: row?.genres ? String(row.genres).split('•').map(item => item.trim()).filter(Boolean) : [mediaType === 'tv' ? 'TV Show' : 'Movie'],
    runtime: row?.runtime ? `${row.runtime}m` : 'Runtime TBA',
    rating: row?.tmdb_rating || null,
    poster: row?.poster_url || '',
    posterUrl: row?.poster_url || '',
    posterPath: '',
    overview: row?.overview || '',
    releaseDate: row?.release_date || '',
    date: row?.release_date || 'Release date TBA',
  };
}

function normalizeOwner(row = {}) {
  const profile = row?.owner || row?.users || null;
  return {
    id: row?.user_id || '',
    name: profile?.full_name || profile?.email?.split('@')[0] || 'CineMate user',
    email: profile?.email || '',
    profileImage: profile?.profile_image || '',
  };
}

async function attachOwnerProfile(collection) {
  if (!collection?.user_id) return collection;

  const { data, error } = await supabase
    .from('users')
    .select('full_name,email,profile_image')
    .eq('user_id', collection.user_id)
    .maybeSingle();

  if (error) return collection;
  return { ...collection, owner: data || null };
}

function newestCollectionItem(items = []) {
  return [...items].sort((a, b) => new Date(b?.addedAt || 0) - new Date(a?.addedAt || 0))[0] || null;
}

function normalizeCollection(row = {}, items = [], meta = {}) {
  const normalizedItems = items.length
    ? items
    : (Array.isArray(row?.collection_items) ? row.collection_items.map(normalizeItem) : []);
  const latestItem = newestCollectionItem(normalizedItems);

  return {
    id: row?.collection_id,
    collectionId: row?.collection_id,
    userId: row?.user_id,
    title: row?.title || 'Untitled collection',
    description: row?.description || '',
    isPublic: row?.is_public !== false,
    isOwner: Boolean(meta.isOwner),
    isCollaborator: Boolean(meta.isCollaborator),
    isPendingInvite: Boolean(meta.isPendingInvite),
    collaborationStatus: meta.collaborationStatus || (meta.isPendingInvite ? 'pending' : (meta.isCollaborator ? 'accepted' : '')),
    invitedBy: meta.invitedBy || '',
    canManageItems: Boolean(meta.isOwner || meta.isCollaborator),
    createdAt: row?.created_at || '',
    updatedAt: row?.updated_at || row?.created_at || '',
    owner: normalizeOwner(row),
    items: normalizedItems,
    itemCount: normalizedItems.length,
    coverItem: latestItem,
    coverMovie: latestItem?.movie || null,
    coverPoster: latestItem?.movie?.poster || latestItem?.movie?.posterUrl || '',
  };
}

function normalizeItem(row = {}) {
  return {
    id: row?.item_id,
    itemId: row?.item_id,
    collectionId: row?.collection_id,
    movieId: row?.movie_id,
    addedAt: row?.added_at || '',
    movie: normalizeMovie(row?.movies || {}, row?.movie_id),
  };
}

async function assertCollectionCanManageItems(collectionId, userId) {
  if (!userId) throw new Error('Please log in to manage collections.');

  const { data, error } = await supabase
    .from('collections')
    .select('collection_id,user_id')
    .eq('collection_id', collectionId)
    .limit(1);

  if (error) throw new Error(error.message);
  const collection = Array.isArray(data) ? data[0] : null;
  if (!collection) throw new Error('Collection was not found or you do not have permission to edit it.');
  if (collection.user_id === userId) return { ...collection, isOwner: true, isCollaborator: false };

  const { data: collaboratorRows, error: collaboratorError } = await supabase
    .from('collection_collaborators')
    .select('collaboration_id,status')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .limit(1);

  if (collaboratorError) {
    if (/collection_collaborators|schema cache|not found|does not exist/i.test(collaboratorError.message || '')) {
      throw new Error('Collection collaboration needs collection_collaborators.sql to be run once in Supabase.');
    }
    throw new Error(collaboratorError.message);
  }

  if (!Array.isArray(collaboratorRows) || !collaboratorRows.length) {
    throw new Error('Collection was not found or you do not have permission to edit it.');
  }

  return { ...collection, isOwner: false, isCollaborator: true };
}

async function assertCollectionOwner(collectionId, userId) {
  if (!userId) throw new Error('Please log in to manage collections.');
  const { data, error } = await supabase
    .from('collections')
    .select('collection_id,user_id')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .limit(1);

  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || !data.length) throw new Error('Collection was not found or you do not have permission to edit it.');
  return data[0];
}

export async function listUserCollections(userId) {
  if (!userId) return [];

  const { data: ownedRows, error } = await supabase
    .from('collections')
    .select(`${COLLECTION_SELECT}, collection_items(${COLLECTION_ITEMS_WITH_MOVIE_SELECT})`)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  let collaboratorRows = [];
  const { data: collaborationLinks, error: collaborationError } = await supabase
    .from('collection_collaborators')
    .select('collection_id,status,added_by')
    .eq('user_id', userId);

  if (collaborationError) {
    if (!/collection_collaborators|schema cache|not found|does not exist/i.test(collaborationError.message || '')) {
      throw new Error(collaborationError.message);
    }
  } else {
    const collaborationMetaById = new Map((collaborationLinks || []).map(row => [row.collection_id, row]));
    const collaboratorIds = [...new Set((collaborationLinks || []).map(row => row.collection_id).filter(Boolean))];
    if (collaboratorIds.length) {
      const { data: rows, error: collaboratorCollectionError } = await supabase
        .from('collections')
        .select(`${COLLECTION_SELECT}, collection_items(${COLLECTION_ITEMS_WITH_MOVIE_SELECT})`)
        .in('collection_id', collaboratorIds)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (collaboratorCollectionError) throw new Error(collaboratorCollectionError.message);
      collaboratorRows = (rows || []).map(row => ({ ...row, collaborationMeta: collaborationMetaById.get(row.collection_id) || {} }));
    }
  }

  const owned = (ownedRows || []).map(row => normalizeCollection(row, [], { isOwner: true }));
  const collaborator = collaboratorRows.map(row => {
    const status = row?.collaborationMeta?.status || 'accepted';
    return normalizeCollection(row, [], {
      isCollaborator: status === 'accepted',
      isPendingInvite: status === 'pending',
      collaborationStatus: status,
      invitedBy: row?.collaborationMeta?.added_by || '',
    });
  });
  const byId = new Map();
  [...owned, ...collaborator].forEach(collection => {
    if (!byId.has(collection.id)) byId.set(collection.id, collection);
  });

  return [...byId.values()].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

export async function createCollection({ title, description = '', isPublic = true } = {}, userId) {
  if (!userId) throw new Error('Please log in to create a collection.');
  const cleanTitle = safeText(title);
  if (!cleanTitle) throw new Error('Please enter a collection name.');

  const { data, error } = await supabase
    .from('collections')
    .insert({
      user_id: userId,
      title: cleanTitle.slice(0, 80),
      description: safeText(description).slice(0, 240),
      is_public: Boolean(isPublic),
    })
    .select(COLLECTION_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return normalizeCollection(data);
}

export async function updateCollection(collectionId, updates = {}, userId) {
  await assertCollectionOwner(collectionId, userId);
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
    const cleanTitle = safeText(updates.title);
    if (!cleanTitle) throw new Error('Please enter a collection name.');
    patch.title = cleanTitle.slice(0, 80);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
    patch.description = safeText(updates.description).slice(0, 240);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'isPublic')) {
    patch.is_public = Boolean(updates.isPublic);
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('collections')
    .update(patch)
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .select(COLLECTION_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return normalizeCollection(data);
}

export async function deleteCollection(collectionId, userId) {
  await assertCollectionOwner(collectionId, userId);

  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return true;
}

export async function getCollection(collectionId, viewerId = null) {
  if (!collectionId) throw new Error('Collection ID is missing.');

  const { data, error } = await supabase
    .from('collections')
    .select(COLLECTION_SELECT)
    .eq('collection_id', collectionId)
    .limit(1);

  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || !data.length) throw new Error('Collection was not found.');

  const collection = data[0];
  const isOwner = Boolean(viewerId && collection.user_id === viewerId);
  let isCollaborator = false;
  let isPendingInvite = false;
  let collaborationStatus = '';
  if (viewerId && !isOwner) {
    const { data: collaboratorRows, error: collaboratorError } = await supabase
      .from('collection_collaborators')
      .select('collaboration_id,status,added_by')
      .eq('collection_id', collectionId)
      .eq('user_id', viewerId)
      .limit(1);

    if (collaboratorError && !/collection_collaborators|schema cache|not found|does not exist/i.test(collaboratorError.message || '')) {
      throw new Error(collaboratorError.message);
    }
    const collaboration = Array.isArray(collaboratorRows) && collaboratorRows.length ? collaboratorRows[0] : null;
    collaborationStatus = collaboration?.status || '';
    isCollaborator = collaborationStatus === 'accepted';
    isPendingInvite = collaborationStatus === 'pending';
  }

  if (collection.is_public === false && !isOwner && !isCollaborator && !isPendingInvite) {
    throw new Error('This collection is private.');
  }

  const { data: items, error: itemError } = await supabase
    .from('collection_items')
    .select(COLLECTION_ITEM_SELECT)
    .eq('collection_id', collectionId)
    .order('added_at', { ascending: false });

  if (itemError) throw new Error(itemError.message);

  const collectionWithOwner = await attachOwnerProfile(collection);

  return {
    ...normalizeCollection(collectionWithOwner, (items || []).map(normalizeItem), { isOwner, isCollaborator, isPendingInvite, collaborationStatus }),
    isOwner: Boolean(isOwner),
    isCollaborator: Boolean(isCollaborator),
    isPendingInvite: Boolean(isPendingInvite),
    collaborationStatus,
    canManageItems: Boolean(isOwner || isCollaborator),
  };
}


export async function listPublicCollectionsByUser(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('collections')
    .select(`${COLLECTION_SELECT}, collection_items(${COLLECTION_ITEMS_WITH_MOVIE_SELECT})`)
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(row => normalizeCollection(row));
}

export async function listCollectionsForMovie(movie, userId) {
  if (!userId) return [];
  const movieId = cleanMovieId(movie);
  const collections = await listUserCollections(userId);
  if (!collections.length) return [];

  const { data, error } = await supabase
    .from('collection_items')
    .select('collection_id')
    .eq('movie_id', movieId)
    .in('collection_id', collections.map(collection => collection.id));

  if (error) throw new Error(error.message);
  const selected = new Set((data || []).map(row => row.collection_id));
  return collections.map(collection => ({ ...collection, hasMovie: selected.has(collection.id) }));
}

export async function addMovieToCollection(collectionId, movie, userId) {
  const permission = await assertCollectionCanManageItems(collectionId, userId);
  const movieId = await ensureMovieExists(movie);

  const { error } = await supabase
    .from('collection_items')
    .insert({ collection_id: collectionId, movie_id: movieId });

  if (error && !isDuplicateError(error)) throw new Error(error.message);

  await supabase
    .from('collections')
    .update({ updated_at: new Date().toISOString() })
    .eq('collection_id', collectionId)
    .eq('user_id', permission.user_id || userId);

  if (!permission.isOwner && permission.user_id && permission.user_id !== userId && !isDuplicateError(error)) {
    const { data: collectionMeta } = await supabase
      .from('collections')
      .select('title')
      .eq('collection_id', collectionId)
      .maybeSingle();

    await createNotification({
      userId: permission.user_id,
      actorId: userId,
      type: 'collection_title_added',
      entityType: 'collection',
      entityId: collectionId,
      metadata: {
        collectionId,
        collectionTitle: collectionMeta?.title || '',
        itemTitle: movie?.title || '',
        movieId,
      },
    });
  }

  return true;
}

export async function removeMovieFromCollection(collectionId, movieId, userId) {
  const permission = await assertCollectionCanManageItems(collectionId, userId);

  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('movie_id', cleanMovieId(movieId));

  if (error) throw new Error(error.message);

  await supabase
    .from('collections')
    .update({ updated_at: new Date().toISOString() })
    .eq('collection_id', collectionId)
    .eq('user_id', permission.user_id || userId);

  return true;
}

export async function setMovieInCollection(collectionId, movie, userId, shouldAdd) {
  if (shouldAdd) return addMovieToCollection(collectionId, movie, userId);
  return removeMovieFromCollection(collectionId, movie, userId);
}
