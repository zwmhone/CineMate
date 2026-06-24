export const MEDIA_TYPE_OPTIONS = [
  { value: 'all', label: 'Movies & TV Shows' },
  { value: 'movie', label: 'Movies Only' },
  { value: 'tv', label: 'TV Shows Only' },
];

export const SORT_OPTIONS = [
  { value: 'default', label: 'Sort By Default' },
  { value: 'most-popular', label: 'Most Popular' },
  { value: 'highest-rated', label: 'Highest Rated' },
  { value: 'newest-release', label: 'Newest Release' },
  { value: 'oldest-release', label: 'Oldest Release' },
  { value: 'shortest-runtime', label: 'Shortest Runtime' },
  { value: 'longest-runtime', label: 'Longest Runtime' },
  { value: 'az-title', label: 'A-Z Title' },
  { value: 'za-title', label: 'Z-A Title' },
];

export const RATING_OPTIONS = [
  { value: 'any', label: 'Any Rating' },
  { value: '9', label: '9.0+ Excellent' },
  { value: '8', label: '8.0+ Very Good' },
  { value: '7', label: '7.0+ Good' },
  { value: '6', label: '6.0+ Decent' },
  { value: '5', label: '5.0+ Average' },
];

export const YEAR_OPTIONS = [
  { value: 'any', label: 'Any Year' },
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
  { value: '2021', label: '2021' },
  { value: '2020', label: '2020' },
  { value: '2020-2022', label: '2020-2022' },
  { value: '2010s', label: '2010s' },
  { value: '2000s', label: '2000s' },
  { value: 'before-2000', label: 'Before 2000' },
];

export const WATCH_STATUS_OPTIONS = [
  { value: 'any', label: 'Any Status' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'watching', label: 'Watching' },
  { value: 'watched', label: 'Watched' },
];

export const GENRE_DISCOVER_MAP = {
  action: { label: 'Action', movie: '28', tv: '10759' },
  adventure: { label: 'Adventure', movie: '12', tv: '10759' },
  animation: { label: 'Animation', movie: '16', tv: '16' },
  comedy: { label: 'Comedy', movie: '35', tv: '35' },
  crime: { label: 'Crime', movie: '80', tv: '80' },
  documentary: { label: 'Documentary', movie: '99', tv: '99' },
  drama: { label: 'Drama', movie: '18', tv: '18' },
  family: { label: 'Family', movie: '10751', tv: '10751' },
  fantasy: { label: 'Fantasy', movie: '14', tv: '10765' },
  history: { label: 'History', movie: '36', tv: '' },
  horror: { label: 'Horror', movie: '27', tv: '' },
  music: { label: 'Music', movie: '10402', tv: '' },
  mystery: { label: 'Mystery', movie: '9648', tv: '9648' },
  news: { label: 'News', movie: '', tv: '10763' },
  reality: { label: 'Reality', movie: '', tv: '10764' },
  romance: { label: 'Romance', movie: '10749', tv: '' },
  science_fiction: { label: 'Science Fiction', movie: '878', tv: '10765' },
  soap: { label: 'Soap', movie: '', tv: '10766' },
  talk: { label: 'Talk', movie: '', tv: '10767' },
  thriller: { label: 'Thriller', movie: '53', tv: '' },
  tv_movie: { label: 'TV Movie', movie: '10770', tv: '' },
  war: { label: 'War', movie: '10752', tv: '10768' },
  western: { label: 'Western', movie: '37', tv: '37' },
};

export const GENRE_OPTIONS = [
  { value: 'any', label: 'All Genres' },
  ...Object.entries(GENRE_DISCOVER_MAP).map(([value, config]) => ({ value, label: config.label })),
];

export const MOVIE_GENRE_OPTIONS = GENRE_OPTIONS;
export const TV_GENRE_OPTIONS = GENRE_OPTIONS;
export const ALL_GENRE_OPTIONS = GENRE_OPTIONS;

export const COUNTRY_OPTIONS = [
  { value: 'any', label: 'Any Country' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'KR', label: 'South Korea' },
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'TH', label: 'Thailand' },
  { value: 'IN', label: 'India' },
  { value: 'MM', label: 'Myanmar' },
  { value: 'PH', label: 'Philippines' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'MX', label: 'Mexico' },
];

export const RUNTIME_OPTIONS = [
  { value: 'any', label: 'Any Runtime' },
  { value: 'under-30', label: 'Under 30 minutes' },
  { value: '30-60', label: '30-60 minutes' },
  { value: 'under-90', label: 'Under 90 minutes' },
  { value: '90-120', label: '90-120 minutes' },
  { value: '120-150', label: '120-150 minutes' },
  { value: 'over-120', label: '2 hours+' },
  { value: 'over-150', label: '2h 30m+' },
];

export const DEFAULT_MOVIE_FILTERS = {
  mediaType: 'all',
  sort: 'default',
  rating: 'any',
  year: 'any',
  country: 'any',
  watchStatus: 'any',
  genre: 'any',
  runtime: 'any',
};

export const MOVIE_FILTER_GROUPS = [
  { key: 'mediaType', label: 'Content Type', options: MEDIA_TYPE_OPTIONS },
  { key: 'sort', label: 'Sort', options: SORT_OPTIONS },
  { key: 'rating', label: 'Rating', options: RATING_OPTIONS },
  { key: 'year', label: 'Year', options: YEAR_OPTIONS },
  { key: 'country', label: 'Country', options: COUNTRY_OPTIONS },
  { key: 'watchStatus', label: 'Watch Status', options: WATCH_STATUS_OPTIONS },
  { key: 'genre', label: 'Genre' },
  { key: 'runtime', label: 'Runtime', options: RUNTIME_OPTIONS },
];

export function getGenreOptions(mediaType = 'all') {
  if (mediaType === 'tv') return TV_GENRE_OPTIONS;
  if (mediaType === 'movie') return MOVIE_GENRE_OPTIONS;
  return ALL_GENRE_OPTIONS;
}

export function getFilterLabel(key, value, filters = DEFAULT_MOVIE_FILTERS) {
  const group = MOVIE_FILTER_GROUPS.find(item => item.key === key);
  const options = key === 'genre' ? getGenreOptions(filters.mediaType) : group?.options;
  return options?.find(option => option.value === value)?.label || value;
}
