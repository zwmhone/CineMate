import { movieBySlug } from './uiData';
import {
  discoverMovies,
  discoverTvShows,
  getMovieCredits,
  getMovieDetails,
  getMovieGenres,
  getNowPlayingMovies,
  getPopularMovies,
  getPopularTvShows,
  getSimilarMovies,
  getSimilarTvShows,
  getTopRatedMovies,
  getTopRatedTvShows,
  getTrendingMovies,
  getTrendingTvShows,
  getTvCredits,
  getTvDetails,
  getTvGenres,
  searchMovies,
  searchMultiTitles,
  searchTvShows,
} from './tmdb';
import { applyRuntime, formatTmdbMovie } from '@/utils/formatMovie';
import { GENRE_DISCOVER_MAP } from '@/constants/movieFilters';

function genresMap(genres = []) {
  return genres.reduce((map, genre) => ({ ...map, [genre.id]: genre.name }), {});
}


function mediaTypeOf(item, fallback = 'movie') {
  const type = item?.media_type || item?.mediaType || fallback;
  return type === 'tv' ? 'tv' : 'movie';
}


function interleaveResults(first = [], second = []) {
  const combined = [];
  const max = Math.max(first.length, second.length);
  for (let index = 0; index < max; index += 1) {
    if (first[index]) combined.push(first[index]);
    if (second[index]) combined.push(second[index]);
  }
  return combined;
}

function mergeByMediaAndId(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.mediaType || 'movie'}:${item.tmdbId || item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitGenreFilter(value) {
  if (!value || value === 'any') return { mediaType: 'all', genreId: null, genreKey: null };
  const text = String(value);
  if (text.includes(':')) {
    const [mediaType, genreId] = text.split(':');
    return { mediaType: mediaType === 'tv' ? 'tv' : 'movie', genreId, genreKey: null };
  }
  const key = text in GENRE_DISCOVER_MAP ? text : null;
  return { mediaType: 'all', genreId: text, genreKey: key };
}

function genreIdForMedia(value, mediaType = 'movie') {
  const parsed = splitGenreFilter(value);
  if (!parsed.genreId) return null;
  if (parsed.genreKey) return GENRE_DISCOVER_MAP[parsed.genreKey]?.[mediaType] || null;
  if (parsed.mediaType !== 'all' && parsed.mediaType !== mediaType) return null;
  return parsed.genreId;
}

function genreLabelForValue(value, genreMap = {}) {
  const parsed = splitGenreFilter(value);
  if (!parsed.genreId) return '';
  if (parsed.genreKey) return GENRE_DISCOVER_MAP[parsed.genreKey]?.label || parsed.genreKey;
  return genreMap[parsed.genreId] || genreMap[value] || parsed.genreId || value;
}

function runtimeMinutes(runtime) {
  if (runtime === null || runtime === undefined || runtime === '') return 0;
  if (Number.isFinite(Number(runtime))) return Number(runtime);
  const text = String(runtime);
  const hours = text.match(/(\d+)\s*h/i);
  const minutes = text.match(/(\d+)\s*m/i);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

function releaseYear(movie) {
  return Number(String(movie.releaseDate || movie.release_date || '').slice(0, 4));
}

function matchesYear(movie, yearFilter) {
  if (!yearFilter || yearFilter === 'any') return true;
  const year = releaseYear(movie);
  if (!Number.isFinite(year)) return false;
  if (yearFilter === '2020-2022') return year >= 2020 && year <= 2022;
  if (yearFilter === '2010s') return year >= 2010 && year <= 2019;
  if (yearFilter === '2000s') return year >= 2000 && year <= 2009;
  if (yearFilter === 'before-2000') return year < 2000;
  return year === Number(yearFilter);
}

function matchesRuntime(movie, runtimeFilter) {
  if (!runtimeFilter || runtimeFilter === 'any') return true;
  const minutes = runtimeMinutes(movie.runtime);
  if (!minutes) return false;
  if (runtimeFilter === 'under-30') return minutes < 30;
  if (runtimeFilter === '30-60') return minutes >= 30 && minutes <= 60;
  if (runtimeFilter === 'under-90') return minutes < 90;
  if (runtimeFilter === '90-120') return minutes >= 90 && minutes <= 120;
  if (runtimeFilter === '120-150') return minutes >= 120 && minutes <= 150;
  if (runtimeFilter === 'over-120') return minutes >= 120;
  if (runtimeFilter === 'over-150') return minutes >= 150;
  return true;
}

function matchesRating(movie, ratingFilter) {
  if (!ratingFilter || ratingFilter === 'any') return true;
  return Number(movie.rating || 0) >= Number(ratingFilter);
}

function matchesGenre(movie, genreFilter, genreMap = {}) {
  if (!genreFilter || genreFilter === 'any') return true;
  const selected = genreLabelForValue(genreFilter, genreMap);
  const genres = Array.isArray(movie.tags) ? movie.tags : String(movie.genre || '').split('•').map(item => item.trim());
  return genres.some(genre => String(genre).toLowerCase() === String(selected).toLowerCase());
}

function sortMovies(movies, sort) {
  const sorted = [...movies];
  if (sort === 'highest-rated') return sorted.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  if (sort === 'newest-release') return sorted.sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')));
  if (sort === 'oldest-release') return sorted.sort((a, b) => String(a.releaseDate || '').localeCompare(String(b.releaseDate || '')));
  if (sort === 'most-popular') return sorted.sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
  if (sort === 'shortest-runtime') return sorted.sort((a, b) => runtimeMinutes(a.runtime) - runtimeMinutes(b.runtime));
  if (sort === 'longest-runtime') return sorted.sort((a, b) => runtimeMinutes(b.runtime) - runtimeMinutes(a.runtime));
  if (sort === 'az-title') return sorted.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  if (sort === 'za-title') return sorted.sort((a, b) => String(b.title || '').localeCompare(String(a.title || '')));
  return sorted;
}

function applyClientFilters(movies, filters = {}, genreMap = {}) {
  const filtered = movies.filter(movie => (
    matchesRating(movie, filters.rating)
    && matchesYear(movie, filters.year)
    && matchesGenre(movie, filters.genre, genreMap)
    && matchesRuntime(movie, filters.runtime)
  ));
  return sortMovies(filtered, filters.sort);
}

function discoverParamsFromFilters(filters = {}, page = 1, mediaType = 'movie') {
  const params = { page };
  const isTv = mediaType === 'tv';

  if (filters.sort === 'highest-rated') params.sort_by = 'vote_average.desc';
  else if (filters.sort === 'newest-release') params.sort_by = isTv ? 'first_air_date.desc' : 'primary_release_date.desc';
  else if (filters.sort === 'oldest-release') params.sort_by = isTv ? 'first_air_date.asc' : 'primary_release_date.asc';
  else if (filters.sort === 'most-popular' || filters.sort === 'default') params.sort_by = 'popularity.desc';

  if (filters.rating && filters.rating !== 'any') params.vote_average_gte = filters.rating;
  const genreId = genreIdForMedia(filters.genre, mediaType);
  if (genreId) params.with_genres = genreId;

  if (filters.country && filters.country !== 'any') {
    params.with_origin_country = filters.country;
  }

  if (filters.year && filters.year !== 'any') {
    const gteKey = isTv ? 'first_air_date_gte' : 'primary_release_date_gte';
    const lteKey = isTv ? 'first_air_date_lte' : 'primary_release_date_lte';
    if (filters.year === '2020-2022') {
      params[gteKey] = '2020-01-01';
      params[lteKey] = '2022-12-31';
    } else if (filters.year === '2010s') {
      params[gteKey] = '2010-01-01';
      params[lteKey] = '2019-12-31';
    } else if (filters.year === '2000s') {
      params[gteKey] = '2000-01-01';
      params[lteKey] = '2009-12-31';
    } else if (filters.year === 'before-2000') {
      params[lteKey] = '1999-12-31';
    } else if (isTv) {
      params.first_air_date_year = filters.year;
    } else {
      params.primary_release_year = filters.year;
    }
  }

  if (filters.runtime === 'under-30') params.with_runtime_lte = 29;
  if (filters.runtime === '30-60') {
    params.with_runtime_gte = 30;
    params.with_runtime_lte = 60;
  }
  if (filters.runtime === 'under-90') params.with_runtime_lte = 89;
  if (filters.runtime === '90-120') {
    params.with_runtime_gte = 90;
    params.with_runtime_lte = 120;
  }
  if (filters.runtime === '120-150') {
    params.with_runtime_gte = 120;
    params.with_runtime_lte = 150;
  }
  if (filters.runtime === 'over-120') params.with_runtime_gte = 120;
  if (filters.runtime === 'over-150') params.with_runtime_gte = 150;

  return params;
}

async function withRuntime(movies, mediaType = 'movie') {
  const limited = movies.slice(0, 20);
  const details = await Promise.allSettled(limited.map(movie => (
    mediaType === 'tv' ? getTvDetails(movie.id) : getMovieDetails(movie.id)
  )));
  return limited.map((movie, index) => {
    const detail = details[index].status === 'fulfilled' ? details[index].value : null;
    return applyRuntime(movie, detail);
  });
}

export async function fetchMovies({ query = '', page = 1, category = 'popular', filters = {} } = {}) {
  try {
    const mediaType = filters.mediaType === 'tv' ? 'tv' : filters.mediaType === 'movie' ? 'movie' : 'all';
    const isTv = mediaType === 'tv';
    const isAll = mediaType === 'all';
    const [movieGenres, tvGenres] = await Promise.all([getMovieGenres(), getTvGenres()]);
    const movieGenreMap = genresMap(movieGenres);
    const tvGenreMap = genresMap(tvGenres);
    const activeGenre = splitGenreFilter(filters.genre);
    const trimmedQuery = query.trim();
    const canSearchMovie = !isTv && activeGenre.mediaType !== 'tv' && (!activeGenre.genreKey || Boolean(GENRE_DISCOVER_MAP[activeGenre.genreKey]?.movie));
    const canSearchTv = mediaType !== 'movie' && activeGenre.mediaType !== 'movie' && (!activeGenre.genreKey || Boolean(GENRE_DISCOVER_MAP[activeGenre.genreKey]?.tv));
    let data;
    let rawResults = [];
    let totalPages = 1;

    const hasDiscoverFilters = !trimmedQuery && (
      (filters.rating && filters.rating !== 'any')
      || (filters.year && filters.year !== 'any')
      || (filters.country && filters.country !== 'any')
      || (filters.genre && filters.genre !== 'any')
      || (filters.runtime && filters.runtime !== 'any')
      || (filters.sort && filters.sort !== 'default' && filters.sort !== 'shortest-runtime' && filters.sort !== 'longest-runtime' && filters.sort !== 'az-title')
    );

    if (trimmedQuery && isAll) {
      const [movieData, tvData] = await Promise.all([
        searchMovies(trimmedQuery, page),
        searchTvShows(trimmedQuery, page),
      ]);
      rawResults = interleaveResults(
        (movieData.results || []).map(item => ({ ...item, media_type: 'movie' })),
        (tvData.results || []).map(item => ({ ...item, media_type: 'tv' }))
      );
      totalPages = Math.max(movieData.total_pages || 1, tvData.total_pages || 1);
      data = { page, total_pages: totalPages };
    } else if (trimmedQuery) {
      data = isTv ? await searchTvShows(trimmedQuery, page) : await searchMovies(trimmedQuery, page);
      rawResults = (data.results || []).map(item => ({ ...item, media_type: mediaType }));
      totalPages = data.total_pages || 1;
    } else if (isAll && hasDiscoverFilters) {
      const requests = [];
      if (canSearchMovie) requests.push(discoverMovies(discoverParamsFromFilters(filters, page, 'movie')).then(result => ({ type: 'movie', result })));
      if (canSearchTv) requests.push(discoverTvShows(discoverParamsFromFilters(filters, page, 'tv')).then(result => ({ type: 'tv', result })));
      const results = await Promise.all(requests.length ? requests : [discoverMovies(discoverParamsFromFilters(filters, page, 'movie')).then(result => ({ type: 'movie', result }))]);
      const movieResults = results.find(item => item.type === 'movie')?.result?.results || [];
      const tvResults = results.find(item => item.type === 'tv')?.result?.results || [];
      rawResults = interleaveResults(
        movieResults.map(item => ({ ...item, media_type: 'movie' })),
        tvResults.map(item => ({ ...item, media_type: 'tv' }))
      );
      totalPages = Math.max(...results.map(({ result }) => result.total_pages || 1), 1);
      data = { page, total_pages: totalPages };
    } else if (isAll) {
      const [movieData, tvData] = await Promise.all([
        category === 'top-rated' ? getTopRatedMovies(page) : category === 'trending' ? getTrendingMovies(page) : category === 'now-playing' ? getNowPlayingMovies(page) : getPopularMovies(page),
        category === 'top-rated' ? getTopRatedTvShows(page) : getTrendingTvShows(page),
      ]);
      rawResults = interleaveResults(
        (movieData.results || []).map(item => ({ ...item, media_type: 'movie' })),
        (tvData.results || []).map(item => ({ ...item, media_type: 'tv' }))
      );
      totalPages = Math.max(movieData.total_pages || 1, tvData.total_pages || 1);
      data = { page, total_pages: totalPages };
    } else if (hasDiscoverFilters) {
      data = isTv
        ? await discoverTvShows(discoverParamsFromFilters(filters, page, mediaType))
        : await discoverMovies(discoverParamsFromFilters(filters, page, mediaType));
      rawResults = (data.results || []).map(item => ({ ...item, media_type: mediaType }));
      totalPages = data.total_pages || 1;
    } else if (!isTv && category === 'trending') {
      data = await getTrendingMovies(page);
      rawResults = (data.results || []).map(item => ({ ...item, media_type: 'movie' }));
      totalPages = data.total_pages || 1;
    } else if (!isTv && category === 'top-rated') {
      data = await getTopRatedMovies(page);
      rawResults = (data.results || []).map(item => ({ ...item, media_type: 'movie' }));
      totalPages = data.total_pages || 1;
    } else if (!isTv && category === 'now-playing') {
      data = await getNowPlayingMovies(page);
      rawResults = (data.results || []).map(item => ({ ...item, media_type: 'movie' }));
      totalPages = data.total_pages || 1;
    } else if (isTv && category === 'top-rated') {
      data = await getTopRatedTvShows(page);
      rawResults = (data.results || []).map(item => ({ ...item, media_type: 'tv' }));
      totalPages = data.total_pages || 1;
    } else if (isTv) {
      data = await getPopularTvShows(page);
      rawResults = (data.results || []).map(item => ({ ...item, media_type: 'tv' }));
      totalPages = data.total_pages || 1;
    } else {
      data = await getPopularMovies(page);
      rawResults = (data.results || []).map(item => ({ ...item, media_type: 'movie' }));
      totalPages = data.total_pages || 1;
    }

    const formatted = rawResults.map((item, index) => {
      const itemType = mediaTypeOf(item, mediaType === 'all' ? 'movie' : mediaType);
      return formatTmdbMovie(item, itemType === 'tv' ? tvGenreMap : movieGenreMap, index, itemType);
    });

    const moviesWithRuntime = await Promise.all(
      formatted.slice(0, 20).map(async movie => {
        try {
          const details = movie.mediaType === 'tv' ? await getTvDetails(movie.tmdbId) : await getMovieDetails(movie.tmdbId);
          return applyRuntime(movie, details);
        } catch {
          return movie;
        }
      })
    );

    const clientGenreMap = { ...movieGenreMap, ...tvGenreMap };
    const movies = trimmedQuery || !hasDiscoverFilters
      ? applyClientFilters(mergeByMediaAndId(moviesWithRuntime), filters, clientGenreMap)
      : sortMovies(mergeByMediaAndId(moviesWithRuntime), filters.sort);

    return {
      movies,
      page: data?.page || page,
      totalPages: Math.min(totalPages || data?.total_pages || 1, 500),
      source: 'tmdb',
    };
  } catch (error) {
    console.warn(error.message);
    return {
      movies: [],
      page: 1,
      totalPages: 1,
      source: 'empty',
      error: error.message,
    };
  }
}

export async function fetchHomeMovies() {
  const [trending, popular, latest, latestTv] = await Promise.all([
    fetchMovies({ category: 'trending', filters: { mediaType: 'all' } }),
    fetchMovies({ category: 'popular', filters: { mediaType: 'movie' } }),
    fetchMovies({ category: 'now-playing', filters: { mediaType: 'movie' } }),
    fetchMovies({ category: 'trending', filters: { mediaType: 'tv' } }),
  ]);

  return {
    trending: trending.movies,
    popular: popular.movies,
    latest: latest.movies,
    latestTv: latestTv.movies,
    recommended: popular.movies.slice(0, 6),
  };
}

export async function searchMovieSuggestions(query, limit = 7, mediaType = 'all') {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) return [];

  try {
    const type = mediaType === 'tv' ? 'tv' : mediaType === 'movie' ? 'movie' : 'all';
    const [movieGenres, tvGenres] = await Promise.all([getMovieGenres(), getTvGenres()]);
    const movieGenreMap = genresMap(movieGenres);
    const tvGenreMap = genresMap(tvGenres);
    let results = [];

    if (type === 'all') {
      const data = await searchMultiTitles(trimmed, 1);
      results = (data.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv');
    } else {
      const data = type === 'tv' ? await searchTvShows(trimmed, 1) : await searchMovies(trimmed, 1);
      results = (data.results || []).map(item => ({ ...item, media_type: type }));
    }

    return results
      .slice(0, limit)
      .map((item, index) => {
        const itemType = mediaTypeOf(item, type === 'all' ? 'movie' : type);
        return formatTmdbMovie(item, itemType === 'tv' ? tvGenreMap : movieGenreMap, index, itemType);
      });
  } catch (error) {
    console.warn(error.message);
    return [];
  }
}

export async function fetchMovieDetail(movieIdOrSlug, mediaType = 'movie') {
  const numericId = Math.abs(Number(movieIdOrSlug));
  const isTv = mediaType === 'tv';

  if (!Number.isFinite(numericId)) {
    const fallback = movieBySlug(movieIdOrSlug);
    return {
      movie: fallback,
      cast: [],
      similar: [],
      source: 'local',
    };
  }

  try {
    const [details, credits, similarData, genres] = await Promise.all([
      isTv ? getTvDetails(numericId) : getMovieDetails(numericId),
      isTv ? getTvCredits(numericId) : getMovieCredits(numericId),
      isTv ? getSimilarTvShows(numericId) : getSimilarMovies(numericId),
      isTv ? getTvGenres() : getMovieGenres(),
    ]);

    const genreMap = genresMap(genres);
    const movie = formatTmdbMovie(details, genreMap, 0, mediaType);
    const cast = (credits.cast || [])
      .filter(person => person?.name)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
      .map(person => ({
        id: person.id,
        tmdbCastId: person.cast_id || person.id,
        name: person.name,
        character: person.character || '',
        profilePath: person.profile_path || '',
        order: person.order ?? null,
      }));
    const similar = (similarData.results || [])
      .filter(item => item.poster_path)
      .slice(0, 6)
      .map((item, index) => formatTmdbMovie(item, genreMap, index + 1, mediaType));

    return {
      movie,
      cast,
      similar,
      source: 'tmdb',
    };
  } catch (error) {
    console.warn(error.message);
    return {
      movie: null,
      cast: [],
      similar: [],
      source: 'error',
      error: error.message,
    };
  }
}
