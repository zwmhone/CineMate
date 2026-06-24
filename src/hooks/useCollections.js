'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  createCollection,
  deleteCollection,
  listUserCollections,
  updateCollection,
} from '@/lib/collections';

export default function useCollections() {
  const { user, isLoggedIn, ready } = useAuth();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refreshCollections = useCallback(async () => {
    setError('');
    if (!ready || !isLoggedIn || !user?.id) {
      setCollections([]);
      return [];
    }

    setLoading(true);
    try {
      const rows = await listUserCollections(user.id);
      setCollections(rows);
      return rows;
    } catch (nextError) {
      const message = nextError.message || 'Could not load collections.';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [ready, isLoggedIn, user?.id]);

  useEffect(() => {
    refreshCollections();
  }, [refreshCollections]);

  const addCollection = useCallback(async values => {
    if (!isLoggedIn || !user?.id) return { success: false, needsLogin: true };
    setSaving(true);
    setError('');
    try {
      const collection = await createCollection(values, user.id);
      setCollections(current => [collection, ...current]);
      return { success: true, collection };
    } catch (nextError) {
      const message = nextError.message || 'Could not create collection.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setSaving(false);
    }
  }, [isLoggedIn, user?.id]);

  const editCollection = useCallback(async (collectionId, updates) => {
    if (!isLoggedIn || !user?.id) return { success: false, needsLogin: true };
    setSaving(true);
    setError('');
    try {
      const collection = await updateCollection(collectionId, updates, user.id);
      let mergedCollection = collection;
      setCollections(current => current.map(item => {
        if (item.id !== collectionId) return item;
        mergedCollection = {
          ...item,
          ...collection,
          isOwner: item.isOwner,
          isCollaborator: item.isCollaborator,
          isPendingInvite: item.isPendingInvite,
          collaborationStatus: item.collaborationStatus || '',
          canManageItems: item.canManageItems,
          items: item.items || [],
          itemCount: item.itemCount || 0,
          coverItem: item.coverItem || null,
          coverMovie: item.coverMovie || null,
          coverPoster: item.coverPoster || '',
        };
        return mergedCollection;
      }));
      return { success: true, collection: mergedCollection };
    } catch (nextError) {
      const message = nextError.message || 'Could not update collection.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setSaving(false);
    }
  }, [isLoggedIn, user?.id]);

  const removeCollection = useCallback(async collectionId => {
    if (!isLoggedIn || !user?.id) return { success: false, needsLogin: true };
    const previous = collections;
    setCollections(current => current.filter(item => item.id !== collectionId));
    setSaving(true);
    setError('');
    try {
      await deleteCollection(collectionId, user.id);
      return { success: true };
    } catch (nextError) {
      setCollections(previous);
      const message = nextError.message || 'Could not delete collection.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setSaving(false);
    }
  }, [collections, isLoggedIn, user?.id]);

  return {
    collections,
    loading,
    saving,
    error,
    refreshCollections,
    addCollection,
    editCollection,
    removeCollection,
  };
}
