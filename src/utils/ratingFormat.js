export function formatRating(value, fallback = '0.0') {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number.toFixed(1);
}

export function ratingToFiveStars(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(5, Math.round(number / 2)));
}
