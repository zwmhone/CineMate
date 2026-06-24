'use client';

import { useEffect, useState } from 'react';

function getShareUrl(movie) {
  if (typeof window === 'undefined') return '';

  const currentUrl = window.location?.href || '';
  if (currentUrl) return currentUrl;

  const id = movie?.id || movie?.movie_id || movie?.tmdbId || movie?.tmdb_id;
  if (!id) return window.location?.origin || '';

  return `${window.location.origin}/movie/${id}`;
}

async function copyText(text) {
  if (!text) return false;

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

export default function ShareButton({ movie }) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 1800);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();

    try {
      const url = getShareUrl(movie);
      const copied = await copyText(url);
      setMessage(copied ? 'Link copied!' : 'Could not copy link');
    } catch (error) {
      setMessage('Could not copy link');
    }
  }

  return (
    <span className="detail-share-wrap">
      <button
        type="button"
        className="detail-share-icon"
        aria-label="Copy share link"
        onClick={handleClick}
        title="Copy share link"
      >
        <svg
          className="detail-share-svg"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M4.75 12.75v5.5a1.5 1.5 0 0 0 1.5 1.5h11.5a1.5 1.5 0 0 0 1.5-1.5v-5.5" />
          <path d="M12 15.25V4.75" />
          <path d="M7.85 8.9 12 4.75l4.15 4.15" />
        </svg>
      </button>
      {message ? (
        <span className="detail-share-toast" role="status" aria-live="polite">
          {message}
        </span>
      ) : null}
    </span>
  );
}
