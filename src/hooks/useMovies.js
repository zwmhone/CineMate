'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchMovies } from '@/lib/movies';

export default function useMovies(initialQuery = '', initialFilters = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadMovies() {
      setLoading(true);
      const result = await fetchMovies({ query, page, filters });
      if (!active) return;
      setMovies(result.movies);
      setTotalPages(result.totalPages || 1);
      setError(result.error || '');
      setLoading(false);
    }

    loadMovies();
    return () => {
      active = false;
    };
  }, [query, page, filters]);

  const updateQuery = useCallback((nextQuery) => {
    setPage(1);
    setQuery(nextQuery);
  }, []);

  const updateFilters = useCallback((nextFilters) => {
    setPage(1);
    setFilters(nextFilters);
  }, []);

  return {
    movies,
    loading,
    error,
    query,
    setQuery: updateQuery,
    filters,
    setFilters: updateFilters,
    page,
    setPage,
    totalPages,
  };
}
