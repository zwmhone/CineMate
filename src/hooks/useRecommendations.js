'use client';

import { useEffect, useRef, useState } from 'react';
import { getContentBasedRecommendations } from '@/lib/recommendationEngine';

const emptyState = {
  recommendations: [],
  topMatches: [],
  profile: null,
  message: '',
};

export default function useRecommendations(userId, limit = 12, genreFilter = 'All') {
  const [data, setData] = useState(emptyState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedData = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadRecommendations() {
      if (!userId) {
        setData(emptyState);
        return;
      }

      if (!hasLoadedData.current) setLoading(true);
      setError('');

      try {
        const result = await getContentBasedRecommendations(userId, { limit, genreFilter });
        if (active) {
          setData(result);
          hasLoadedData.current = true;
        }
      } catch (loadError) {
        if (active) {
          if (!hasLoadedData.current) setData(emptyState);
          setError(loadError.message || 'Could not load recommendations right now.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRecommendations();
    return () => {
      active = false;
    };
  }, [userId, limit, genreFilter]);

  return {
    ...data,
    loading,
    error,
  };
}
