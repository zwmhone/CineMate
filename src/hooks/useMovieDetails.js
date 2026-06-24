'use client';

import { useEffect, useState } from 'react';
import { fetchMovieDetail } from '@/lib/movies';
import { movieBySlug } from '@/lib/uiData';

function isNumericMovieId(value) {
  return Number.isFinite(Number(value));
}

export default function useMovieDetails(movieIdOrSlug, mediaType = 'movie') {
  const numeric = isNumericMovieId(movieIdOrSlug);
  const [movie, setMovie] = useState(() => (numeric ? null : movieBySlug(movieIdOrSlug)));
  const [cast, setCast] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(numeric);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const nextIsNumeric = isNumericMovieId(movieIdOrSlug);

    async function loadDetail() {
      setLoading(true);
      setError('');

      if (nextIsNumeric) {
        setMovie(null);
        setCast([]);
        setSimilar([]);
      } else {
        setMovie(movieBySlug(movieIdOrSlug));
        setCast([]);
        setSimilar([]);
      }

      const result = await fetchMovieDetail(movieIdOrSlug, mediaType);
      if (!active) return;
      setMovie(result.movie);
      setCast(result.cast);
      setSimilar(result.similar);
      setError(result.error || '');
      setLoading(false);
    }

    loadDetail();
    return () => {
      active = false;
    };
  }, [movieIdOrSlug, mediaType]);

  return { movie, cast, similar, loading, error };
}
