export const WATCH_STATES = [
  { label: 'Wishlist', value: 'wishlist' },
  { label: 'Watching', value: 'watching' },
  { label: 'Watched', value: 'watched' },
];

export const WATCH_STATUS_PLACEHOLDER = 'Watch Status';

export function normaliseWatchStatus(status) {
  const value = String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
  const match = WATCH_STATES.find(item => item.value === value || item.label.toLowerCase() === value.replace(/_/g, ' '));
  return match || null;
}

export function isValidWatchState(status) {
  return Boolean(normaliseWatchStatus(status));
}

export function getWatchStatusLabel(status) {
  return normaliseWatchStatus(status)?.label || WATCH_STATUS_PLACEHOLDER;
}

export function getWatchStatusValue(status) {
  return normaliseWatchStatus(status)?.value || '';
}
