'use client';

import { detailUrl } from '@/lib/uiData';
import { MoviePoster } from '@/components/movie/MovieCard';

export default function CollectionMovieCard({ item, canRemove = false, removing = false, onRemove }) {
  const movie = item?.movie || item;
  return (
    <article className="collection-movie-card" data-href={detailUrl(movie)}>
      <MoviePoster movie={movie} size="w342" />
      <div className="collection-movie-body">
        <div className="collection-movie-heading">
          <h3>{movie.title}</h3>
          {movie.rating && <span>★ {movie.rating}</span>}
        </div>
        <p>{movie.genre || 'Movie'}</p>
        <small>{movie.runtime || 'Runtime TBA'}</small>
        <div className="collection-movie-actions" data-no-card-nav>
          <button type="button" data-href={detailUrl(movie)}>View details</button>
          {canRemove && (
            <button type="button" className="danger" disabled={removing} onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              onRemove?.(item);
            }}>
              Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
