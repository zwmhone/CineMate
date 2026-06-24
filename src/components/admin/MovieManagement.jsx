'use client';

import { useMemo, useState } from 'react';

function formatDate(value) {
  if (!value) return 'No release date';
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch {
    return 'No release date';
  }
}

function viewCopy(mode) {
  if (mode === 'favourites') {
    return {
      eyebrow: 'Favourite records',
      title: 'Most Favourited Titles',
      help: 'View-only list of saved movie and TV records ordered by how often users added them to favourites.',
      empty: 'No favourited titles yet.',
    };
  }

  return {
    eyebrow: 'Rating records',
    title: 'Most Rated Titles',
    help: 'View-only list of saved movie and TV records ordered by user rating activity.',
    empty: 'No rated titles yet.',
  };
}

export default function MovieManagement({ movies = [], mode = 'ratings' }) {
  const [query, setQuery] = useState('');
  const copy = viewCopy(mode);

  const filteredMovies = useMemo(() => {
    const value = query.trim().toLowerCase();
    return movies
      .filter(movie => {
        if (mode === 'ratings' && Number(movie.ratings_count || 0) <= 0) return false;
        if (mode === 'favourites' && Number(movie.favourites_count || 0) <= 0) return false;
        if (!value) return true;
        return String(movie.title || '').toLowerCase().includes(value)
          || String(movie.genres || '').toLowerCase().includes(value)
          || String(movie.movie_id || '').includes(value);
      })
      .sort((a, b) => {
        const key = mode === 'favourites' ? 'favourites_count' : 'ratings_count';
        return Number(b[key] || 0) - Number(a[key] || 0);
      });
  }, [movies, query, mode]);

  return (
    <section className="cm-admin-panel cm-admin-wide-panel">
      <div className="cm-admin-section-head">
        <div>
          <p className="cm-admin-eyebrow">{copy.eyebrow}</p>
          <h3>{copy.title}</h3>
          <p className="cm-admin-help-text">{copy.help}</p>
        </div>
        <div className="cm-admin-actions-row">
          <input
            className="cm-admin-search"
            type="search"
            placeholder="Search titles..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="Search titles"
          />
        </div>
      </div>

      <div className="cm-admin-card-list cm-admin-movie-list">
        {filteredMovies.map(movie => (
          <article key={movie.movie_id} className="cm-admin-list-card cm-admin-movie-card cm-admin-view-only-card">
            {movie.poster_url ? (
              <img className="cm-admin-movie-poster" src={movie.poster_url} alt={`${movie.title} poster`} loading="lazy" />
            ) : (
              <div className="cm-admin-movie-poster is-fallback">{String(movie.title || 'M').charAt(0)}</div>
            )}
            <div className="cm-admin-movie-main">
              <strong>{movie.title || `Movie ${movie.movie_id}`}</strong>
              <span>ID {movie.movie_id} · {formatDate(movie.release_date)}</span>
              <small>{movie.genres || 'No genres saved'}</small>
            </div>
            <div className="cm-admin-list-stats">
              <span>{Number(movie.favourites_count || 0)} favourites</span>
              <span>{Number(movie.ratings_count || 0)} ratings</span>
              <span>{Number(movie.comments_count || 0)} comments</span>
            </div>
          </article>
        ))}
      </div>

      {!filteredMovies.length && <p className="cm-admin-meta cm-admin-empty">{copy.empty}</p>}
    </section>
  );
}
