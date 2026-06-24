const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

function buildUrl(path, params = {}) {
  if (!API_KEY) {
    throw new Error('Missing NEXT_PUBLIC_TMDB_API_KEY in .env.local');
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('language', params.language || 'en-US');

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && key !== 'language') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

export async function tmdbFetch(path, params = {}) {
  const response = await fetch(buildUrl(path, params));
  if (!response.ok) {
    throw new Error(`TMDb request failed: ${response.status}`);
  }
  return response.json();
}

export async function getMovieGenres() {
  const data = await tmdbFetch('/genre/movie/list');
  return data.genres || [];
}

export async function getTvGenres() {
  const data = await tmdbFetch('/genre/tv/list');
  return data.genres || [];
}

export async function getPopularMovies(page = 1) {
  return tmdbFetch('/movie/popular', { page });
}

export async function getTrendingMovies(page = 1) {
  return tmdbFetch('/trending/movie/week', { page });
}

export async function getTopRatedMovies(page = 1) {
  return tmdbFetch('/movie/top_rated', { page });
}

export async function getNowPlayingMovies(page = 1) {
  return tmdbFetch('/movie/now_playing', { page });
}


export async function discoverMovies(params = {}) {
  return tmdbFetch('/discover/movie', {
    page: params.page || 1,
    sort_by: params.sort_by,
    'vote_average.gte': params.vote_average_gte,
    'vote_count.gte': params.vote_count_gte,
    'with_original_language': params.with_original_language,
    primary_release_year: params.primary_release_year,
    'primary_release_date.gte': params.primary_release_date_gte,
    'primary_release_date.lte': params.primary_release_date_lte,
    'with_runtime.gte': params.with_runtime_gte,
    'with_runtime.lte': params.with_runtime_lte,
    with_genres: params.with_genres,
    with_keywords: params.with_keywords,
    without_keywords: params.without_keywords,
    without_genres: params.without_genres,
    with_origin_country: params.with_origin_country,
    include_adult: false,
  });
}

export async function searchMovies(query, page = 1) {
  return tmdbFetch('/search/movie', {
    query,
    page,
    include_adult: false,
  });
}

export async function getMovieDetails(movieId) {
  return tmdbFetch(`/movie/${movieId}`);
}

export async function getMovieCredits(movieId) {
  return tmdbFetch(`/movie/${movieId}/credits`);
}

export async function getSimilarMovies(movieId, page = 1) {
  return tmdbFetch(`/movie/${movieId}/similar`, { page });
}


export async function searchMultiTitles(query, page = 1) {
  return tmdbFetch('/search/multi', {
    query,
    page,
    include_adult: false,
  });
}

export async function getTrendingTvShows(page = 1) {
  return tmdbFetch('/trending/tv/week', { page });
}

export async function getPopularTvShows(page = 1) {
  return tmdbFetch('/tv/popular', { page });
}

export async function getTopRatedTvShows(page = 1) {
  return tmdbFetch('/tv/top_rated', { page });
}

export async function discoverTvShows(params = {}) {
  return tmdbFetch('/discover/tv', {
    page: params.page || 1,
    sort_by: params.sort_by,
    'vote_average.gte': params.vote_average_gte,
    'vote_count.gte': params.vote_count_gte,
    'with_original_language': params.with_original_language,
    first_air_date_year: params.first_air_date_year,
    'first_air_date.gte': params.first_air_date_gte,
    'first_air_date.lte': params.first_air_date_lte,
    'with_runtime.gte': params.with_runtime_gte,
    'with_runtime.lte': params.with_runtime_lte,
    with_genres: params.with_genres,
    with_keywords: params.with_keywords,
    without_keywords: params.without_keywords,
    without_genres: params.without_genres,
    with_origin_country: params.with_origin_country,
    include_adult: false,
  });
}

export async function searchTvShows(query, page = 1) {
  return tmdbFetch('/search/tv', {
    query,
    page,
    include_adult: false,
  });
}

export async function getTvDetails(tvId) {
  return tmdbFetch(`/tv/${tvId}`);
}

export async function getTvCredits(tvId) {
  return tmdbFetch(`/tv/${tvId}/credits`);
}

export async function getSimilarTvShows(tvId, page = 1) {
  return tmdbFetch(`/tv/${tvId}/similar`, { page });
}

export async function getMovieRecommendations(movieId, page = 1) {
  return tmdbFetch(`/movie/${movieId}/recommendations`, { page });
}

export async function getTvRecommendations(tvId, page = 1) {
  return tmdbFetch(`/tv/${tvId}/recommendations`, { page });
}

export async function getMovieKeywords(movieId) {
  return tmdbFetch(`/movie/${movieId}/keywords`);
}

export async function getTvKeywords(tvId) {
  return tmdbFetch(`/tv/${tvId}/keywords`);
}

export async function searchTmdbKeywords(query, page = 1) {
  return tmdbFetch('/search/keyword', {
    query,
    page,
  });
}

export async function searchPeople(query, page = 1) {
  return tmdbFetch('/search/person', {
    query,
    page,
    include_adult: false,
  });
}

export async function getPersonCombinedCredits(personId) {
  return tmdbFetch(`/person/${personId}/combined_credits`);
}
