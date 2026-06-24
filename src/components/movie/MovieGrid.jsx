import { PosterCard } from './MovieCard';

function addPageRange(pages, start, end) {
  for (let value = start; value <= end; value += 1) {
    if (!pages.includes(value)) pages.push(value);
  }
}

function buildPageNumbers(page, totalPages) {
  const safeTotal = Math.max(1, Math.min(Number(totalPages) || 1, 500));
  const current = Math.max(1, Math.min(Number(page) || 1, safeTotal));

  if (safeTotal <= 9) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  const numericPages = [];
  addPageRange(numericPages, 1, Math.min(3, safeTotal));

  const middleStart = Math.max(4, current - 1);
  const middleEnd = Math.min(safeTotal - 3, current + 1);
  if (middleStart <= middleEnd) addPageRange(numericPages, middleStart, middleEnd);

  addPageRange(numericPages, Math.max(safeTotal - 2, 1), safeTotal);

  const sortedPages = [...numericPages].sort((a, b) => a - b);
  const pages = [];

  sortedPages.forEach((value, index) => {
    const previous = sortedPages[index - 1];
    if (index > 0 && value - previous > 1) {
      pages.push(`ellipsis-${previous}-${value}`);
    }
    pages.push(value);
  });

  return pages;
}

export default function MovieGrid({ movies = [], page = 1, totalPages = 1, onPageChange }) {
  const pages = buildPageNumbers(page, totalPages);
  const safeTotal = Math.max(1, Math.min(Number(totalPages) || 1, 500));
  const current = Math.max(1, Math.min(Number(page) || 1, safeTotal));

  function goToPage(nextPage) {
    const value = Math.max(1, Math.min(Number(nextPage) || 1, safeTotal));
    if (value !== current) onPageChange?.(value);
  }

  return (
    <>
      <div className="movie-grid" id="movieGrid">
        {movies.map((movie, index) => <PosterCard key={`${movie.mediaType || 'movie'}-${movie.id || movie.tmdbId || movie.title}-${index}`} movie={movie} />)}
      </div>
      {safeTotal > 1 && (
        <div className="pagination" aria-label="Movie pages">
          <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => goToPage(current - 1)}>‹</button>
          {pages.map(item => (
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                className={item === current ? 'active' : ''}
                aria-current={item === current ? 'page' : undefined}
                onClick={() => goToPage(item)}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="pagination-ellipsis" aria-hidden="true">…</span>
            )
          ))}
          <button type="button" aria-label="Next page" disabled={current >= safeTotal} onClick={() => goToPage(current + 1)}>›</button>
        </div>
      )}
    </>
  );
}
