import { supabase } from '@/lib/supabaseClient';
import { getWatchStatusLabel, getWatchStatusValue } from '@/constants/watchStates';
import { getTmdbImageUrl } from '@/utils/imageUrl';

function hasTvMediaType(movieOrId = {}) {
  const type = String(movieOrId?.mediaType || movieOrId?.media_type || movieOrId?.type || '').toLowerCase();
  if (type === 'tv' || type === 'show' || type === 'series') return true;

  const storedId = Number(movieOrId?.dbMovieId ?? movieOrId?.storedMovieId ?? movieOrId?.movie_id);
  if (Number.isFinite(storedId) && storedId < 0) return true;

  const genres = String(movieOrId?.genres || movieOrId?.genre || '').toLowerCase();
  return /sci-fi & fantasy|action & adventure|kids|war & politics|talk|soap|reality/.test(genres);
}

export function cleanMovieId(movieOrId) {
  const isObject = typeof movieOrId === 'object' && movieOrId !== null;
  const raw = isObject
    ? movieOrId?.dbMovieId ?? movieOrId?.storedMovieId ?? movieOrId?.movie_id ?? movieOrId?.tmdbId ?? movieOrId?.tmdb_id ?? movieOrId?.id
    : movieOrId;

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error('Movie ID is missing, so this action cannot be saved.');
  }

  if (isObject && hasTvMediaType(movieOrId)) {
    return -Math.abs(value);
  }

  return value;
}

function publicTmdbIdFromStoredId(movieId) {
  const value = Number(movieId);
  return Number.isFinite(value) ? Math.abs(value) : movieId;
}

function mediaTypeFromStoredId(movieRow = {}, fallback = 'movie') {
  if (hasTvMediaType(movieRow)) return 'tv';
  const value = Number(movieRow?.movie_id ?? movieRow?.dbMovieId ?? movieRow?.id);
  if (Number.isFinite(value) && value < 0) return 'tv';
  return fallback;
}

export function isDuplicateError(error) {
  const text = `${error?.code || ''} ${error?.status || ''} ${error?.message || ''} ${error?.details || ''}`;
  return /23505|409|duplicate|conflict|already exists/i.test(text);
}

function extractRuntimeMinutes(runtime) {
  if (runtime === null || runtime === undefined || runtime === '') return null;
  if (Number.isFinite(Number(runtime))) return Number(runtime);

  const text = String(runtime);
  const hours = text.match(/(\d+)\s*h/i);
  const minutes = text.match(/(\d+)\s*m/i);
  const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  return total || null;
}

function extractRating(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function extractReleaseDate(movie) {
  const raw = movie?.releaseDate || movie?.release_date || movie?.first_air_date || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function extractCssUrl(value) {
  const text = String(value || '');
  const match = text.match(/url\((['\"]?)(.*?)\1\)/i);
  return match?.[2] || '';
}

function isRealPosterUrl(value) {
  const text = String(value || '').trim();
  return text.startsWith('http') || text.startsWith('/');
}

function extractPosterUrl(movie) {
  const direct = movie?.posterUrl || movie?.poster_url;
  if (isRealPosterUrl(direct)) return direct;

  const directFromCss = extractCssUrl(direct);
  if (isRealPosterUrl(directFromCss)) return directFromCss;

  const path = movie?.posterPath || movie?.poster_path;
  if (path) return getTmdbImageUrl(path, 'w500');

  const poster = movie?.poster || '';
  if (isRealPosterUrl(poster)) return poster;

  const posterFromCss = extractCssUrl(poster);
  if (isRealPosterUrl(posterFromCss)) return posterFromCss;

  return null;
}

function buildMovieRow(movieOrId) {
  const movieId = cleanMovieId(movieOrId);
  const movie = typeof movieOrId === 'object' && movieOrId ? movieOrId : {};
  const tags = Array.isArray(movie.tags) ? movie.tags.join(' • ') : null;

  return {
    movie_id: movieId,
    title: movie.title || movie.name || `${movie?.mediaType === 'tv' || movieId < 0 ? 'TV Show' : 'Movie'} ${Math.abs(movieId)}`,
    poster_url: extractPosterUrl(movie),
    genres: movie.genres || movie.genre || tags || null,
    overview: movie.overview || null,
    release_date: extractReleaseDate(movie),
    tmdb_rating: extractRating(movie.rating || movie.tmdb_rating || movie.vote_average),
    language: movie.language || movie.original_language || null,
    runtime: extractRuntimeMinutes(movie.runtime),
  };
}

function normaliseMovieFromMovieRow(movieRow, fallbackMovieId = null) {
  const storedMovieId = movieRow?.movie_id || fallbackMovieId;
  const mediaType = mediaTypeFromStoredId(movieRow);
  const tmdbId = publicTmdbIdFromStoredId(storedMovieId);
  return {
    id: tmdbId,
    tmdbId,
    dbMovieId: storedMovieId,
    mediaType,
    title: movieRow?.title || `${mediaType === 'tv' ? 'TV Show' : 'Movie'} ${tmdbId}`,
    genre: movieRow?.genres || (mediaType === 'tv' ? 'TV Show' : 'Movie'),
    runtime: movieRow?.runtime ? `${movieRow.runtime}m` : 'Runtime TBA',
    rating: movieRow?.tmdb_rating || null,
    poster: movieRow?.poster_url || '',
    posterPath: null,
    overview: movieRow?.overview || null,
    releaseDate: movieRow?.release_date || null,
  };
}

function normaliseMovieFromRow(row, fallbackStatus = 'Movie') {
  const nestedMovie = row.movies || row.movie || null;
  if (nestedMovie) return normaliseMovieFromMovieRow(nestedMovie, row.movie_id);

  const storedMovieId = row.movie_id || row.tmdb_id || row.id;
  const mediaType = mediaTypeFromStoredId(row, /tv/i.test(fallbackStatus) ? 'tv' : 'movie');
  const tmdbId = publicTmdbIdFromStoredId(storedMovieId);
  return {
    id: tmdbId,
    tmdbId,
    dbMovieId: storedMovieId,
    mediaType,
    title: row.movie_title || row.title || `${mediaType === 'tv' ? 'TV Show' : 'Movie'} ${tmdbId}`,
    genre: row.genre || row.movie_genre || row.genres || fallbackStatus,
    runtime: row.runtime || row.movie_runtime || 'Runtime TBA',
    rating: row.rating || row.tmdb_rating || null,
    poster: row.poster || row.poster_url || row.poster_path || '',
    posterPath: row.poster_path || null,
    overview: row.overview || null,
    releaseDate: row.release_date || row.date || null,
  };
}

async function selectOneByUserAndMovie(table, userId, movieId) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .limit(1);

  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function ensureMovieExists(movieOrId) {
  const movieId = cleanMovieId(movieOrId);
  const row = buildMovieRow(movieOrId);

  const { data: existing, error: selectError } = await supabase
    .from('movies')
    .select('movie_id,title,poster_url,genres,overview,release_date,tmdb_rating,language,runtime')
    .eq('movie_id', movieId)
    .limit(1);

  if (selectError) throw new Error(selectError.message);

  if (Array.isArray(existing) && existing.length) {
    const current = existing[0];
    const patch = {};

    Object.entries(row).forEach(([key, value]) => {
      if (key === 'movie_id' || value === null || value === undefined || value === '') return;
      const currentValue = current[key];
      const isMissing = currentValue === null || currentValue === undefined || currentValue === '';
      const needsPosterRepair = key === 'poster_url' && !isRealPosterUrl(currentValue);
      if (isMissing || needsPosterRepair) patch[key] = value;
    });

    if (Object.keys(patch).length) {
      const { error: updateError } = await supabase
        .from('movies')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('movie_id', movieId);

      if (updateError && !/updated_at/i.test(updateError.message || '')) {
        throw new Error(updateError.message);
      }

      if (updateError && /updated_at/i.test(updateError.message || '')) {
        const { error: updateWithoutTimestampError } = await supabase
          .from('movies')
          .update(patch)
          .eq('movie_id', movieId);

        if (updateWithoutTimestampError) throw new Error(updateWithoutTimestampError.message);
      }
    }

    return movieId;
  }

  const { error: insertError } = await supabase
    .from('movies')
    .insert(row);

  if (insertError && !isDuplicateError(insertError)) {
    throw new Error(insertError.message);
  }

  return movieId;
}

export async function getFavourite(movieId, userId) {
  if (!userId || !movieId) return null;
  return selectOneByUserAndMovie('favourites', userId, cleanMovieId(movieId));
}

export async function isMovieFavourite(movieId, userId) {
  return Boolean(await getFavourite(movieId, userId));
}

export async function addFavourite(movie, userId) {
  if (!userId) throw new Error('Please log in before adding favourites.');

  const movieId = await ensureMovieExists(movie);
  const existing = await getFavourite(movieId, userId);
  if (existing) return { user_id: userId, movie_id: movieId, alreadySaved: true };

  const { error: insertError } = await supabase
    .from('favourites')
    .insert({ user_id: userId, movie_id: movieId });

  if (insertError) {
    if (isDuplicateError(insertError)) {
      return { user_id: userId, movie_id: movieId, alreadySaved: true };
    }
    throw new Error(insertError.message);
  }

  return { user_id: userId, movie_id: movieId };
}

export async function removeFavourite(movieId, userId) {
  if (!userId) throw new Error('Please log in before removing favourites.');

  const { error } = await supabase
    .from('favourites')
    .delete()
    .eq('user_id', userId)
    .eq('movie_id', cleanMovieId(movieId));

  if (error) throw new Error(error.message);
  return true;
}

export async function setFavourite(movie, userId, shouldBeFavourite) {
  const movieId = cleanMovieId(movie);
  if (shouldBeFavourite) {
    await addFavourite(movie, userId);
    return { isFavourite: true };
  }
  await removeFavourite(movieId, userId);
  return { isFavourite: false };
}

export async function toggleFavourite(movie, userId) {
  if (!userId) throw new Error('Please log in before adding favourites.');

  const movieId = cleanMovieId(movie);
  const existing = await getFavourite(movieId, userId);

  if (existing) {
    await removeFavourite(movieId, userId);
    return { isFavourite: false };
  }

  await addFavourite(movie, userId);
  return { isFavourite: true };
}

export async function listUserFavourites(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('favourites')
    .select('created_at, movie_id, movies(movie_id,title,poster_url,genres,overview,release_date,tmdb_rating,runtime)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map(row => ({
    createdAt: row.created_at,
    movie: normaliseMovieFromRow(row, 'Favourite Movie'),
    status: 'Favourite',
  }));
}

export async function getWatchState(movieId, userId) {
  if (!userId || !movieId) return null;
  return selectOneByUserAndMovie('watch_states', userId, cleanMovieId(movieId));
}

export async function getWatchStatus(movieId, userId) {
  const row = await getWatchState(movieId, userId);
  return row?.status || row?.watch_status || row?.state || null;
}

export async function removeWatchStatus(movieId, userId) {
  if (!userId) throw new Error('Please log in before updating watch status.');

  const { error } = await supabase
    .from('watch_states')
    .delete()
    .eq('user_id', userId)
    .eq('movie_id', cleanMovieId(movieId));

  if (error) throw new Error(error.message);
  return null;
}

export async function saveWatchStatus(movie, userId, nextStatus) {
  if (!userId) throw new Error('Please log in before updating watch status.');

  const movieId = await ensureMovieExists(movie);
  const statusValue = getWatchStatusValue(nextStatus);
  if (!statusValue) throw new Error('Please choose Wishlist, Watching, or Watched.');

  const existing = await getWatchState(movieId, userId);

  if (existing) {
    const { error: updateError } = await supabase
      .from('watch_states')
      .update({ status: statusValue, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('movie_id', movieId);

    if (updateError) {
      const { error: statusOnlyError } = await supabase
        .from('watch_states')
        .update({ status: statusValue })
        .eq('user_id', userId)
        .eq('movie_id', movieId);

      if (statusOnlyError) throw new Error(statusOnlyError.message);
    }

    return statusValue;
  }

  const { error: insertError } = await supabase
    .from('watch_states')
    .insert({ user_id: userId, movie_id: movieId, status: statusValue });

  if (insertError) {
    if (isDuplicateError(insertError)) {
      const { error: updateAfterConflictError } = await supabase
        .from('watch_states')
        .update({ status: statusValue, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('movie_id', movieId);

      if (updateAfterConflictError) throw new Error(updateAfterConflictError.message);
      return statusValue;
    }
    throw new Error(insertError.message);
  }

  return statusValue;
}

export async function listUserWatchStates(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('watch_states')
    .select('created_at, updated_at, status, movie_id, movies(movie_id,title,poster_url,genres,overview,release_date,tmdb_rating,runtime)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data || []).map(row => {
    const savedStatus = row.status || row.watch_status || row.state;
    return {
      updatedAt: row.updated_at || row.created_at,
      movie: normaliseMovieFromRow(row, `${getWatchStatusLabel(savedStatus)} Movie`),
      status: getWatchStatusLabel(savedStatus),
    };
  });
}
