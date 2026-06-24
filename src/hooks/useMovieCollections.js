'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  createCollection,
  listCollectionsForMovie,
  setMovieInCollection,
} from '@/lib/collections';

export default function useMovieCollections(movie) {
  const { user, isLoggedIn, ready } = useAuth();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refreshCollections = useCallback(async () => {
    setError('');
    if (!ready || !isLoggedIn || !user?.id || !movie) {
      setCollections([]);
      return [];
    }

    setLoading(true);
    try {
      const rows = await listCollectionsForMovie(movie, user.id);
      setCollections(rows);
      return rows;
    } catch (nextError) {
      const message = nextError.message || 'Could not load collections.';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [ready, isLoggedIn, user?.id, movie]);

  useEffect(() => {
    refreshCollections();
  }, [refreshCollections]);

  const toggleMovie = useCallback(async (collectionId, shouldAdd) => {
    if (!isLoggedIn || !user?.id) return { success: false, needsLogin: true };
    const previous = collections;
    setCollections(current => current.map(collection => (
      collection.id === collectionId ? { ...collection, hasMovie: shouldAdd } : collection
    )));
    setSaving(true);
    setError('');
    try {
      await setMovieInCollection(collectionId, movie, user.id, shouldAdd);
      await refreshCollections();
      return { success: true };
    } catch (nextError) {
      setCollections(previous);
      const message = nextError.message || 'Could not update collection.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setSaving(false);
    }
  }, [collections, isLoggedIn, movie, refreshCollections, user?.id]);

  const addCollectionWithMovie = useCallback(async values => {
    if (!isLoggedIn || !user?.id) return { success: false, needsLogin: true };
    setSaving(true);
    setError('');
    try {
      const collection = await createCollection(values, user.id);
      await setMovieInCollection(collection.id, movie, user.id, true);
      await refreshCollections();
      return { success: true, collection };
    } catch (nextError) {
      const message = nextError.message || 'Could not create collection.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setSaving(false);
    }
  }, [isLoggedIn, movie, refreshCollections, user?.id]);

  return {
    collections,
    loading,
    saving,
    error,
    refreshCollections,
    toggleMovie,
    addCollectionWithMovie,
  };
}
