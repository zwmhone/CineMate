'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { detailUrl } from '@/lib/uiData';
import { getMovieDetails, getTvDetails } from '@/lib/tmdb';
import { getTmdbImageUrl, PLACEHOLDER_POSTER } from '@/utils/imageUrl';

function extractCssUrl(value) {
  const match = String(value || '').match(/url\((['\"]?)(.*?)\1\)/i);
  return match?.[2] || '';
}

function normalisePosterUrl(value) {
  const direct = String(value || '').trim();
  if (!direct || direct.startsWith('linear-gradient')) {
    const fromCss = extractCssUrl(direct);
    return fromCss.startsWith('http') || fromCss.startsWith('/') ? fromCss : '';
  }
  if (direct.startsWith('http') || direct.startsWith('/')) return direct;
  const fromCss = extractCssUrl(direct);
  if (fromCss.startsWith('http') || fromCss.startsWith('/')) return fromCss;
  return '';
}

const DASHBOARD_POSTER_FALLBACK_MS = 30000;
const DASHBOARD_POSTER_ATTEMPT_TIMEOUT_MS = 6500;
const DASHBOARD_POSTER_RETRY_DELAYS_MS = [1200, 2200, 3400];

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

function buildDashboardPosterSources(movie, fetchedPosterPath) {
  const source = normalisePosterUrl(movie?.poster || movie?.posterUrl || movie?.poster_url);
  const sources = [];

  if (source) {
    sources.push(...tmdbSourcesFromFullUrl(source, 'w185'));
  }

  const posterPath = movie?.posterPath || movie?.poster_path || fetchedPosterPath;
  if (posterPath) {
    sources.push(
      getTmdbImageUrl(posterPath, 'w185'),
      getTmdbImageUrl(posterPath, 'w342'),
      getTmdbImageUrl(posterPath, 'w500')
    );
  }

  return uniqueImageSources(sources).filter(src => src !== PLACEHOLDER_POSTER);
}

function DashboardPoster({ movie }) {
  const wrapperRef = useRef(null);
  const retryTimer = useRef(null);
  const attemptTimer = useRef(null);
  const fallbackTimer = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [fetchedPosterPath, setFetchedPosterPath] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const sources = useMemo(
    () => buildDashboardPosterSources(movie, fetchedPosterPath),
    [movie?.poster, movie?.posterUrl, movie?.poster_url, movie?.posterPath, movie?.poster_path, fetchedPosterPath]
  );

  const requestedSrc = sources[attempt] || '';
  const src = showFallback || !requestedSrc ? PLACEHOLDER_POSTER : requestedSrc;
  const isFallbackPoster = src === PLACEHOLDER_POSTER;

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
      { rootMargin: '360px 0px' }
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
  }, [sources.join('|'), movie?.id, movie?.tmdbId]);

  useEffect(() => {
    let active = true;
    const tmdbId = movie?.tmdbId || movie?.id;

    if (!shouldLoad || sources.length || fetchedPosterPath || !tmdbId || !Number.isFinite(Number(tmdbId))) return undefined;

    async function loadMissingPosterPath() {
      try {
        const details = movie?.mediaType === 'tv' ? await getTvDetails(Number(tmdbId)) : await getMovieDetails(Number(tmdbId));
        if (active && details?.poster_path) {
          setFetchedPosterPath(details.poster_path);
        }
      } catch (error) {
        if (active) setShowFallback(true);
      }
    }

    loadMissingPosterPath();
    return () => {
      active = false;
    };
  }, [shouldLoad, sources.length, fetchedPosterPath, movie?.tmdbId, movie?.id]);

  useEffect(() => {
    setLoaded(false);
    window.clearTimeout(attemptTimer.current);

    if (!shouldLoad || loaded || isFallbackPoster || !sources.length) return undefined;

    attemptTimer.current = window.setTimeout(() => {
      retryPosterBeforeFallback();
    }, DASHBOARD_POSTER_ATTEMPT_TIMEOUT_MS);

    return () => window.clearTimeout(attemptTimer.current);
  }, [shouldLoad, src, attempt, isFallbackPoster, sources.length]);

  useEffect(() => {
    window.clearTimeout(fallbackTimer.current);

    if (!shouldLoad || loaded || isFallbackPoster || !sources.length) return undefined;

    fallbackTimer.current = window.setTimeout(() => {
      window.clearTimeout(retryTimer.current);
      window.clearTimeout(attemptTimer.current);
      setShowFallback(true);
    }, DASHBOARD_POSTER_FALLBACK_MS);

    return () => window.clearTimeout(fallbackTimer.current);
  }, [shouldLoad, sources.length, loaded, isFallbackPoster, sources.join('|')]);

  useEffect(() => () => {
    window.clearTimeout(retryTimer.current);
    window.clearTimeout(attemptTimer.current);
    window.clearTimeout(fallbackTimer.current);
  }, []);

  function retryPosterBeforeFallback() {
    if (showFallback || loaded) return;

    window.clearTimeout(retryTimer.current);
    window.clearTimeout(attemptTimer.current);

    if (attempt >= sources.length - 1) {
      setShowFallback(true);
      return;
    }

    const delay = DASHBOARD_POSTER_RETRY_DELAYS_MS[Math.min(attempt, DASHBOARD_POSTER_RETRY_DELAYS_MS.length - 1)];
    retryTimer.current = window.setTimeout(() => {
      setAttempt(current => Math.min(current + 1, sources.length - 1));
    }, delay);
  }

  const className = `poster-thumb poster-image${shouldLoad && src && !loaded && !isFallbackPoster ? ' is-loading' : ''}${isFallbackPoster ? ' is-placeholder-poster' : ''}`;

  return (
    <div ref={wrapperRef} className={className}>
      {shouldLoad ? (
        <img
          src={src}
          alt={`${movie?.title || 'Movie'} poster`}
          loading="lazy"
          decoding="async"
          onLoad={() => {
            window.clearTimeout(retryTimer.current);
            window.clearTimeout(attemptTimer.current);
            window.clearTimeout(fallbackTimer.current);
            setLoaded(true);
          }}
          onError={isFallbackPoster ? undefined : retryPosterBeforeFallback}
        />
      ) : null}
    </div>
  );
}

export function DashboardMovieItem({ movie, status }) {
  return (
    <article className="dash-item" data-href={detailUrl(movie)}>
      <DashboardPoster movie={movie} />
      <div className="dash-item-copy">
        <strong>{movie.title}</strong>
        <p>{movie.genre}</p>
        <span className="pill">{movie.runtime}</span>
      </div>
      <span className="pill dash-status-pill">{status}</span>
    </article>
  );
}

function sortItems(items, newestFirst) {
  return [...items].sort((a, b) => {
    const first = new Date(a.sortDate || a.updatedAt || a.createdAt || 0).getTime();
    const second = new Date(b.sortDate || b.updatedAt || b.createdAt || 0).getTime();
    return newestFirst ? second - first : first - second;
  });
}

export default function WatchStateList({ items = [], emptyMessage = 'No movies saved here yet.' }) {
  const [newestFirst, setNewestFirst] = useState(true);
  const sortedItems = useMemo(() => sortItems(items, newestFirst), [items, newestFirst]);

  if (!items.length) {
    return <p className="meta dashboard-empty-message">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="dashboard-sort-row">
        <button type="button" className="dashboard-sort-toggle" onClick={() => setNewestFirst(value => !value)}>
          <span aria-hidden="true">{newestFirst ? '↓' : '↑'}</span>
          {newestFirst ? 'Newest First' : 'Oldest First'}
        </button>
      </div>
      <div className="dash-list dashboard-list-scroll" id="watchList">
        {sortedItems.map(item => <DashboardMovieItem key={`${item.movie.dbMovieId || item.movie.id || item.movie.title}-${item.status}`} {...item} />)}
      </div>
    </>
  );
}
