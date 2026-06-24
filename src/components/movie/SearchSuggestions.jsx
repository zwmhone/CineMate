'use client';

import { useState } from 'react';
import { detailUrl } from '@/lib/uiData';
import { getTmdbImageUrl } from '@/utils/imageUrl';

function SuggestionPoster({ movie }) {
  const [failed, setFailed] = useState(false);
  const src = movie?.posterPath && !failed ? getTmdbImageUrl(movie.posterPath, 'w92') : '';

  return (
    <span className={`search-suggestion-poster poster-image${src ? '' : ' no-poster'}`} aria-hidden="true">
      {src ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="no-poster-label">No Poster</span>
      )}
    </span>
  );
}

export default function SearchSuggestions({ results = [], open = false, loading = false, onSelect }) {
  if (!open) return null;

  return (
    <div className="search-suggestions" role="listbox" aria-label="Search suggestions">
      {loading && <div className="search-suggestion-empty">Searching titles...</div>}
      {!loading && results.length === 0 && <div className="search-suggestion-empty">No titles found</div>}
      {!loading && results.map((movie, index) => (
        <button
          type="button"
          className="search-suggestion-item"
          key={movie.id || movie.tmdbId || `${movie.title}-${movie.releaseYear || movie.date}-${index}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect?.(detailUrl(movie))}
        >
          <SuggestionPoster movie={movie} />
          <span className="search-suggestion-copy">
            <strong>{movie.title}</strong>
            <small>{movie.releaseYear || movie.date}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
