'use client';

import { useState } from 'react';
import LoginPromptModal from '@/components/common/LoginPromptModal';
import useRecommendationFeedback from '@/hooks/useRecommendationFeedback';

export default function DislikeIconButton({ movie }) {
  const { isDisliked, loading, error, toggleDislike } = useRecommendationFeedback(movie);
  const [loginMessage, setLoginMessage] = useState('');

  async function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();

    const result = await toggleDislike();
    if (result.needsLogin) setLoginMessage('You must be logged in to dislike titles.');
  }

  return (
    <>
      <button
        type="button"
        className={`detail-dislike-icon${isDisliked ? ' disliked' : ''}`}
        aria-label={isDisliked ? 'Remove dislike feedback' : 'Dislike this title'}
        aria-pressed={isDisliked}
        disabled={loading}
        onClick={handleClick}
        title={error || (isDisliked ? 'Remove dislike feedback' : 'Dislike this title to improve recommendations')}
      >
        {loading ? (
          <span className="detail-dislike-loading" aria-hidden="true">...</span>
        ) : (
          <svg
            className="detail-dislike-svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              className="detail-dislike-thumb"
              d="M15.25 3.25H7.35c-.95 0-1.8.58-2.16 1.47L2.42 11.6c-.1.25-.15.52-.15.79v1.42c0 1.28 1.04 2.32 2.32 2.32h4.72l-.65 3.08c-.13.63.06 1.28.52 1.74l.76.76 5.98-5.98c.42-.42.66-.99.66-1.59V4.58c0-.73-.6-1.33-1.33-1.33Z"
            />
            <path
              className="detail-dislike-sleeve"
              d="M19.02 3.25h2.71v12.88h-2.71c-.73 0-1.33-.6-1.33-1.33V4.58c0-.73.6-1.33 1.33-1.33Z"
            />
          </svg>
        )}
      </button>
      <LoginPromptModal message={loginMessage} onClose={() => setLoginMessage('')} />
    </>
  );
}
