'use client';

import { useState } from 'react';
import LoginPromptModal from '@/components/common/LoginPromptModal';
import useFavourites from '@/hooks/useFavourites';

export default function FavouriteButton({ movie }) {
  const { isFavourite, loading, error, toggleFavourite } = useFavourites(movie);
  const [loginMessage, setLoginMessage] = useState('');

  async function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();

    const result = await toggleFavourite();
    if (result.needsLogin) setLoginMessage('You must be logged in to add favourites.');
  }

  return (
    <>
      <button
        type="button"
        className={isFavourite ? 'liked' : ''}
        aria-label={isFavourite ? 'Remove from favourite' : 'Add to favourite'}
        aria-pressed={isFavourite}
        disabled={loading}
        onClick={handleClick}
        title={error || ''}
      >
        {loading ? 'Saving...' : isFavourite ? 'Added To Favourite' : 'Add To Favourite'}
      </button>
      <LoginPromptModal message={loginMessage} onClose={() => setLoginMessage('')} />
    </>
  );
}
