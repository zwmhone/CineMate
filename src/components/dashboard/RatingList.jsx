'use client';

import { useMemo, useState } from 'react';
import { DashboardMovieItem } from './WatchStateList';

function sortItems(items, newestFirst) {
  return [...items].sort((a, b) => {
    const first = new Date(a.sortDate || a.updatedAt || a.createdAt || 0).getTime();
    const second = new Date(b.sortDate || b.updatedAt || b.createdAt || 0).getTime();
    return newestFirst ? second - first : first - second;
  });
}

export default function RatingList({ items = [], emptyMessage = 'You have not rated any movies yet.' }) {
  const [newestFirst, setNewestFirst] = useState(true);
  const sortedItems = useMemo(() => sortItems(items, newestFirst), [items, newestFirst]);

  if (!items.length) return <p className="meta dashboard-empty-message">{emptyMessage}</p>;

  return (
    <>
      <div className="dashboard-sort-row">
        <button type="button" className="dashboard-sort-toggle" onClick={() => setNewestFirst(value => !value)}>
          <span aria-hidden="true">{newestFirst ? '↓' : '↑'}</span>
          {newestFirst ? 'Newest First' : 'Oldest First'}
        </button>
      </div>
      <div className="dash-list dashboard-list-scroll">
        {sortedItems.map(item => (
          <DashboardMovieItem
            key={`${item.movie.dbMovieId || item.movie.id || item.movie.title}-${item.rating || 'rating'}`}
            movie={item.movie}
            status={`Rated ${item.rating || item.ratingValue || 0}/5`}
          />
        ))}
      </div>
    </>
  );
}
