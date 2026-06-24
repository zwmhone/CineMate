const DEFAULT_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
export const PLACEHOLDER_POSTER = '/placeholder-poster.svg';

export function getTmdbImageUrl(path, size = 'w500') {
  if (!path) return '';
  const text = String(path).trim();
  if (!text) return '';
  if (text.startsWith('http') || text.startsWith('/placeholder')) return text;
  const normalisedPath = text.startsWith('/') ? text : `/${text}`;
  const base = (process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE_URL || DEFAULT_IMAGE_BASE).replace(/\/w\d+$/, `/${size}`);
  return `${base}${normalisedPath}`;
}

export function getPosterBackground(path, fallback = '') {
  const url = getTmdbImageUrl(path);
  if (!url) return fallback;
  return `linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.10)), url("${url}") center/cover no-repeat`;
}
