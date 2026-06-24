import { formatReleaseDate, formatRuntime } from './dateFormat';
import { getPosterBackground } from './imageUrl';
import { formatRating } from './ratingFormat';

const FALLBACK_POSTERS = [
  'linear-gradient(160deg,#111,#6b35ff)',
  'linear-gradient(160deg,#101629,#7c3cff 55%,#ff4bd8)',
  'linear-gradient(160deg,#10203a,#22d3ee 55%,#ff9d42)',
  'linear-gradient(160deg,#201128,#ff4bd8 50%,#7c3cff)',
  'linear-gradient(160deg,#050505,#7c3cff 50%,#111827)',
];

function fallbackPoster(index = 0) {
  return FALLBACK_POSTERS[index % FALLBACK_POSTERS.length];
}

export function formatTmdbMovie(movie, genresById = {}, index = 0, mediaType = 'movie') {
  const genreNames = Array.isArray(movie?.genres)
    ? movie.genres.map(genre => genre.name).filter(Boolean)
    : (movie?.genre_ids || []).map(id => genresById[id]).filter(Boolean);

  return {
    id: movie.id,
    tmdbId: movie.id,
    dbMovieId: mediaType === 'tv' && Number.isFinite(Number(movie.id)) ? -Math.abs(Number(movie.id)) : movie.id,
    title: movie.title || movie.name || (mediaType === 'tv' ? 'Untitled TV Show' : 'Untitled Movie'),
    mediaType,
    date: formatReleaseDate(movie.release_date || movie.first_air_date),
    releaseDate: movie.release_date || movie.first_air_date || '',
    releaseYear: (movie.release_date || movie.first_air_date || '').slice(0, 4) || 'Release date TBA',
    genre: genreNames.length ? genreNames.join(' • ') : (mediaType === 'tv' ? 'TV Show' : 'Movie'),
    rating: formatRating(movie.vote_average),
    runtime: formatRuntime(movie.runtime || (Array.isArray(movie.episode_run_time) ? movie.episode_run_time[0] : 0)),
    poster: getPosterBackground(movie.poster_path, fallbackPoster(index)),
    posterPath: movie.poster_path || '',
    hasPoster: Boolean(movie.poster_path),
    backdropPath: movie.backdrop_path || '',
    overview: movie.overview || `No overview is available for this ${mediaType === 'tv' ? 'TV show' : 'movie'} yet.`,
    tags: genreNames.length ? genreNames : [mediaType === 'tv' ? 'TV Show' : 'Movie'],
    popularity: movie.popularity || 0,
    voteCount: movie.vote_count || 0,
    originalLanguage: movie.original_language || movie.originalLanguage || '',
  };
}

export function applyRuntime(movie, details) {
  if (!details) return movie;
  const mediaRuntime = details.runtime || (Array.isArray(details.episode_run_time) ? details.episode_run_time[0] : 0);
  return {
    ...movie,
    runtime: formatRuntime(mediaRuntime),
    overview: details.overview || movie.overview,
    tags: Array.isArray(details.genres) && details.genres.length ? details.genres.map(genre => genre.name) : movie.tags,
    genre: Array.isArray(details.genres) && details.genres.length ? details.genres.map(genre => genre.name).join(' • ') : movie.genre,
  };
}
