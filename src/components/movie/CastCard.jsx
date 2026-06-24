'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getTmdbImageUrl } from '@/utils/imageUrl';

const CAST_FINAL_FALLBACK_MS = 30000;
const CAST_ATTEMPT_TIMEOUT_MS = 8000;
const CAST_RETRY_DELAYS_MS = [1600, 2600, 4000];

function uniqueImageSources(items) {
  return [...new Set(items.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
}

function tmdbSourcesFromFullUrl(url, preferredSize = 'w185') {
  const text = String(url || '').trim();
  const match = text.match(/^(https?:\/\/image\.tmdb\.org\/t\/p\/)\/?(?:w\d+|original)(\/.*)$/i);
  if (!match) return text ? [text] : [];

  const [, base, path] = match;
  return uniqueImageSources([preferredSize, 'w185', 'w342', 'w500'].map(size => `${base}${size}${path}`));
}

function buildCastImageSources(item) {
  const sources = [];

  if (item.profileUrl) {
    sources.push(...tmdbSourcesFromFullUrl(item.profileUrl, 'w185'));
  }

  if (item.profilePath) {
    sources.push(
      getTmdbImageUrl(item.profilePath, 'w185'),
      getTmdbImageUrl(item.profilePath, 'w342'),
      getTmdbImageUrl(item.profilePath, 'w500')
    );
  }

  return uniqueImageSources(sources);
}

function normaliseCast(cast) {
  if (typeof cast === 'string') {
    const [name, character] = cast.split(' / ');
    return {
      name: name || 'Cast Member',
      character: character || '',
      profilePath: '',
      profileUrl: '',
    };
  }

  return {
    name: cast?.name || cast?.cast_name || 'Cast Member',
    character: cast?.character || cast?.character_name || '',
    profilePath: cast?.profilePath || cast?.profile_path || '',
    profileUrl: cast?.profileUrl || cast?.profile_url || '',
  };
}

export default function CastCard({ cast, name }) {
  const item = normaliseCast(cast || name);
  const wrapperRef = useRef(null);
  const retryTimer = useRef(null);
  const attemptTimer = useRef(null);
  const fallbackTimer = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const sources = useMemo(() => buildCastImageSources(item), [item.profileUrl, item.profilePath]);
  const imageUrl = sources[attempt] || '';
  const hasImage = Boolean(imageUrl) && !showFallback;
  const canRequestImage = shouldLoad && hasImage;

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      setShouldLoad(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldLoad(true);
          setShowFallback(false);
          observer.disconnect();
        }
      },
      { rootMargin: '420px 0px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [sources.join('|')]);

  useEffect(() => {
    window.clearTimeout(retryTimer.current);
    window.clearTimeout(attemptTimer.current);
    window.clearTimeout(fallbackTimer.current);
    setAttempt(0);
    setLoaded(false);
    setShowFallback(false);
  }, [sources.join('|')]);

  useEffect(() => {
    setLoaded(false);
    window.clearTimeout(attemptTimer.current);

    if (!canRequestImage || loaded || !sources.length) return undefined;

    attemptTimer.current = window.setTimeout(() => {
      retryCastImageBeforeFallback();
    }, CAST_ATTEMPT_TIMEOUT_MS);

    return () => window.clearTimeout(attemptTimer.current);
  }, [canRequestImage, imageUrl, attempt, sources.length]);

  useEffect(() => {
    window.clearTimeout(fallbackTimer.current);

    if (!canRequestImage || loaded || !sources.length) return undefined;

    fallbackTimer.current = window.setTimeout(() => {
      window.clearTimeout(retryTimer.current);
      window.clearTimeout(attemptTimer.current);
      setShowFallback(true);
    }, CAST_FINAL_FALLBACK_MS);

    return () => window.clearTimeout(fallbackTimer.current);
  }, [canRequestImage, sources.length, loaded, sources.join('|')]);

  useEffect(() => () => {
    window.clearTimeout(retryTimer.current);
    window.clearTimeout(attemptTimer.current);
    window.clearTimeout(fallbackTimer.current);
  }, []);

  function retryCastImageBeforeFallback() {
    if (showFallback || loaded) return;

    window.clearTimeout(retryTimer.current);
    window.clearTimeout(attemptTimer.current);

    if (attempt >= sources.length - 1) {
      setShowFallback(true);
      return;
    }

    const delay = CAST_RETRY_DELAYS_MS[Math.min(attempt, CAST_RETRY_DELAYS_MS.length - 1)];
    retryTimer.current = window.setTimeout(() => {
      setAttempt(current => Math.min(current + 1, sources.length - 1));
    }, delay);
  }

  const initials = item.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'C';

  return (
    <div ref={wrapperRef} className="cast">
      <div className={`cast-avatar${hasImage ? ' has-cast-image' : ''}${canRequestImage && !loaded ? ' is-loading' : ''}`.trim()}>
        {canRequestImage ? (
          <img
            src={imageUrl}
            alt={`${item.name} profile`}
            loading="lazy"
            decoding="async"
            onLoad={() => {
              window.clearTimeout(retryTimer.current);
              window.clearTimeout(attemptTimer.current);
              window.clearTimeout(fallbackTimer.current);
              setLoaded(true);
            }}
            onError={retryCastImageBeforeFallback}
          />
        ) : (
          <span className="cast-avatar-fallback">{initials}</span>
        )}
      </div>
      <small>
        <strong>{item.name}</strong>
        {item.character ? <span> / {item.character}</span> : null}
      </small>
    </div>
  );
}
