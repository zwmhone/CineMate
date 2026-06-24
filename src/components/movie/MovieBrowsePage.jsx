'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { listUserWatchStates } from '@/lib/userInteractions';
import useMovies from '@/hooks/useMovies';
import MovieFilters, { DEFAULT_MOVIE_FILTERS } from './MovieFilters';
import MovieGrid from './MovieGrid';
import SearchBar from './SearchBar';

function statusKeyForMovie(movie) {
  const mediaType = movie?.mediaType === 'tv' || Number(movie?.dbMovieId || movie?.movie_id) < 0 ? 'tv' : 'movie';
  const id = Math.abs(Number(movie?.tmdbId || movie?.id || movie?.movie_id || movie?.dbMovieId));
  return Number.isFinite(id) ? `${mediaType}:${id}` : '';
}

export default function MovieBrowsePage() {
  const { user, ready } = useAuth();
  const {
    movies,
    loading,
    error,
    query,
    setQuery,
    filters,
    setFilters,
    page,
    setPage,
    totalPages,
  } = useMovies('', DEFAULT_MOVIE_FILTERS);
  const [watchStatusMap, setWatchStatusMap] = useState({});

  useEffect(() => {
    const search = new URLSearchParams(window.location.search).get('search') || '';
    if (search) setQuery(search);
  }, [setQuery]);

  useEffect(() => {
    let active = true;

    async function loadWatchStatuses() {
      if (!ready || !user?.id || filters.watchStatus === 'any') {
        setWatchStatusMap({});
        return;
      }

      try {
        const data = await listUserWatchStates(user.id);
        if (!active) return;
        const nextMap = {};
        data.forEach(item => {
          const key = statusKeyForMovie(item.movie);
          if (key) nextMap[key] = String(item.status || '').toLowerCase();
        });
        setWatchStatusMap(nextMap);
      } catch (loadError) {
        console.warn(loadError.message);
        if (active) setWatchStatusMap({});
      }
    }

    loadWatchStatuses();
    return () => {
      active = false;
    };
  }, [ready, user?.id, filters.watchStatus]);

  const visibleMovies = useMemo(() => {
    if (filters.watchStatus === 'any') return movies;
    if (!user?.id) return [];

    return movies.filter(movie => {
      return watchStatusMap[statusKeyForMovie(movie)] === filters.watchStatus;
    });
  }, [movies, filters.watchStatus, user?.id, watchStatusMap]);

  function handlePageChange(nextPage) {
    setPage(nextPage);
    const grid = document.getElementById('movieGrid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="genres-page">
      <section className="explore page-section" id="genres">
        <MovieFilters filters={filters} onChange={setFilters} />
        <div className="explore-content reveal delay-1">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Browse</p>
              <h2>{filters.mediaType === 'tv' ? 'Explore TV Shows' : filters.mediaType === 'movie' ? 'Explore Movies' : 'Explore Titles'}</h2>
            </div>
            <SearchBar value={query} onSearch={setQuery} suggestions mediaType={filters.mediaType} />
          </div>
          {filters.watchStatus !== 'any' && !user?.id && (
            <p className="meta">Log in to filter by your watch status.</p>
          )}
          {loading && <p className="meta">Loading titles...</p>}
          {error && <p className="meta">TMDb could not be reached. Please try again shortly.</p>}
          {!loading && !error && visibleMovies.length === 0 && (
            <div className="empty-results" role="status">
              <h3>{query ? `No titles found for “${query}”` : filters.mediaType === 'tv' ? 'No matching TV shows found' : filters.mediaType === 'movie' ? 'No matching movies found' : 'No matching titles found'}</h3>
              <p>Try a different title or remove some filters.</p>
            </div>
          )}
          {visibleMovies.length > 0 && (
            <MovieGrid movies={visibleMovies} page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          )}
        </div>
      </section>
    </main>
  );
}
