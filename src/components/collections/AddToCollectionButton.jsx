'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useMovieCollections from '@/hooks/useMovieCollections';
import CollectionPickerModal from './CollectionPickerModal';

function requireLogin(message) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cinemate:require-login', { detail: message }));
}

function CollectionIcon({ added }) {
  if (added) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M5 5.75C5 4.78 5.78 4 6.75 4h4.2c.55 0 1.06.26 1.38.71l.87 1.24h4.05c.97 0 1.75.78 1.75 1.75v2.05a4.7 4.7 0 0 0-1.5-.24V7.7a.25.25 0 0 0-.25-.25h-4.44a.75.75 0 0 1-.61-.32l-1.1-1.56a.25.25 0 0 0-.2-.1H6.75a.25.25 0 0 0-.25.25v10.5c0 .14.11.25.25.25h7.24c.24.57.58 1.08 1 1.5H6.75A1.75 1.75 0 0 1 5 16.22V5.75Z" />
        <path d="M17.8 18.35a.75.75 0 0 1-.53-.22l-2.15-2.15a.75.75 0 1 1 1.06-1.06l1.62 1.62 3.26-3.26a.75.75 0 1 1 1.06 1.06l-3.79 3.79a.75.75 0 0 1-.53.22Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M5 5.75C5 4.78 5.78 4 6.75 4h4.2c.55 0 1.06.26 1.38.71l.87 1.24h4.05c.97 0 1.75.78 1.75 1.75v1.1a3.95 3.95 0 0 0-1.5-.3V7.7a.25.25 0 0 0-.25-.25h-4.44a.75.75 0 0 1-.61-.32l-1.1-1.56a.25.25 0 0 0-.2-.1H6.75a.25.25 0 0 0-.25.25v10.5c0 .14.11.25.25.25h7.77c.18.55.48 1.06.87 1.5H6.75A1.75 1.75 0 0 1 5 16.22V5.75Z" />
      <path d="M18 10.25a.75.75 0 0 1 .75.75v2.25H21a.75.75 0 0 1 0 1.5h-2.25V17a.75.75 0 0 1-1.5 0v-2.25H15a.75.75 0 0 1 0-1.5h2.25V11a.75.75 0 0 1 .75-.75Z" />
    </svg>
  );
}

export default function AddToCollectionButton({ movie }) {
  const { isLoggedIn } = useAuth();
  const { collections, refreshCollections } = useMovieCollections(movie);
  const [open, setOpen] = useState(false);
  const isAdded = useMemo(() => collections.some(collection => collection.hasMovie), [collections]);

  function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!isLoggedIn) {
      requireLogin('Please log in to add movies and shows to custom collections.');
      return;
    }
    setOpen(true);
  }

  async function handleChanged() {
    await refreshCollections();
  }

  return (
    <>
      <button
        type="button"
        className={`detail-icon-button collection-icon-button${isAdded ? ' is-added' : ''}`}
        aria-label={isAdded ? 'Saved in a collection' : 'Add to collection'}
        title={isAdded ? 'Saved in collection' : 'Add to collection'}
        onClick={handleClick}
        data-no-card-nav
      >
        <CollectionIcon added={isAdded} />
      </button>
      {open && <CollectionPickerModal movie={movie} onClose={() => setOpen(false)} onChanged={handleChanged} />}
    </>
  );
}
