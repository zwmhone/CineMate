import FavouriteButton from './FavouriteButton';
import WatchStatusDropdown from './WatchStatusDropdown';

export function UserRatingStars({ rating = 0, onRate }) {
  const current = Number(rating || 0);

  return (
    <div className="rating user-rating" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          className={`user-star${i <= current ? ' active' : ''}`}
          data-value={i}
          aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof onRate === 'function') onRate(i);
          }}
        >
          {i <= current ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}

export default function MovieActions({ movie }) {
  return (
    <div className="detail-actions">
      <FavouriteButton movie={movie} />
      <WatchStatusDropdown movie={movie} />
    </div>
  );
}
