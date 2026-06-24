'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { detailUrl } from '@/lib/uiData';
import { getTmdbImageUrl, PLACEHOLDER_POSTER } from '@/utils/imageUrl';

function extractPosterSource(movie) {
  const direct = movie?.posterUrl || movie?.poster_url || movie?.poster;
  const text = String(direct || '').trim();
  if (!text || text.startsWith('linear-gradient')) return '';
  if (text.startsWith('http') || text.startsWith('/')) return text;
  const match = text.match(/url\((['"]?)(.*?)\1\)/i);
  return match?.[2] || '';
}

const POSTER_FINAL_FALLBACK_MS = 30000;
const POSTER_ATTEMPT_TIMEOUT_MS = 8000;
const POSTER_RETRY_DELAYS_MS = [1600, 2600, 4000];

function uniqueImageSources(items) {
  return [...new Set(items.filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
}

function tmdbSourcesFromFullUrl(url, preferredSize = 'w342') {
  const text = String(url || '').trim();
  const match = text.match(/^(https?:\/\/image\.tmdb\.org\/t\/p\/)\/?(?:w\d+|original)(\/.*)$/i);
  if (!match) return text ? [text] : [];

  const [, base, path] = match;
  return uniqueImageSources([preferredSize, 'w342', 'w185', 'w500'].map(size => `${base}${size}${path}`));
}

function buildPosterSources(movie, preferredSize = 'w342') {
  const directPoster = extractPosterSource(movie);
  const sources = [];

  if (directPoster) {
    sources.push(...tmdbSourcesFromFullUrl(directPoster, preferredSize));
  }

  if (movie?.posterPath) {
    sources.push(
      getTmdbImageUrl(movie.posterPath, preferredSize),
      getTmdbImageUrl(movie.posterPath, 'w342'),
      getTmdbImageUrl(movie.posterPath, 'w185'),
      getTmdbImageUrl(movie.posterPath, 'w500')
    );
  }

  return uniqueImageSources(sources).filter(src => src !== PLACEHOLDER_POSTER);
}

function posterClass(movie, extra = '') {
  return `${extra} poster-thumb poster-image${movie?.hasPoster === false ? ' no-poster' : ''}`.trim();
}

export function MoviePoster({ movie, extra = '', size = 'w342' }) {
  const wrapperRef = useRef(null);
  const retryTimer = useRef(null);
  const attemptTimer = useRef(null);
  const fallbackTimer = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const sources = useMemo(() => buildPosterSources(movie, size), [movie, movie?.posterPath, movie?.posterUrl, movie?.poster_url, movie?.poster, size]);

  const isDetailPoster = String(extra || '').includes('detail-poster');
  const requestedSrc = sources[attempt] || '';
  const src = showFallback || !requestedSrc ? PLACEHOLDER_POSTER : requestedSrc;
  const isFallbackPoster = src === PLACEHOLDER_POSTER;
  const canRequestImage = shouldLoad || isDetailPoster;

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element || isDetailPoster) {
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
  }, [isDetailPoster, sources.join('|')]);

  useEffect(() => {
    window.clearTimeout(retryTimer.current);
    window.clearTimeout(attemptTimer.current);
    window.clearTimeout(fallbackTimer.current);
    setAttempt(0);
    setLoaded(false);
    setShowFallback(false);
  }, [movie?.posterPath, movie?.posterUrl, movie?.poster_url, movie?.poster, sources.join('|')]);

  useEffect(() => {
    setLoaded(false);
    window.clearTimeout(attemptTimer.current);

    if (!canRequestImage || loaded || isFallbackPoster || !sources.length) return undefined;

    attemptTimer.current = window.setTimeout(() => {
      retryPosterBeforeFallback();
    }, POSTER_ATTEMPT_TIMEOUT_MS);

    return () => window.clearTimeout(attemptTimer.current);
  }, [canRequestImage, src, attempt, isFallbackPoster, sources.length]);

  useEffect(() => {
    window.clearTimeout(fallbackTimer.current);

    if (!canRequestImage || loaded || isFallbackPoster || !sources.length) return undefined;

    fallbackTimer.current = window.setTimeout(() => {
      window.clearTimeout(retryTimer.current);
      window.clearTimeout(attemptTimer.current);
      setShowFallback(true);
    }, POSTER_FINAL_FALLBACK_MS);

    return () => window.clearTimeout(fallbackTimer.current);
  }, [canRequestImage, sources.length, loaded, isFallbackPoster, sources.join('|')]);

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

    const delay = POSTER_RETRY_DELAYS_MS[Math.min(attempt, POSTER_RETRY_DELAYS_MS.length - 1)];
    retryTimer.current = window.setTimeout(() => {
      setAttempt(current => Math.min(current + 1, sources.length - 1));
    }, delay);
  }

  const className = `${posterClass({ ...movie, hasPoster: Boolean(src) }, extra)}${canRequestImage && src && !loaded && !isFallbackPoster ? ' is-loading' : ''}${isFallbackPoster ? ' is-placeholder-poster' : ''}`;

  return (
    <div ref={wrapperRef} className={className} data-href={detailUrl(movie)}>
      {canRequestImage ? (
        <img
          src={src}
          alt={`${movie?.title || 'Movie'} poster`}
          loading={isDetailPoster ? 'eager' : 'lazy'}
          fetchPriority={isDetailPoster ? 'high' : 'auto'}
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

export function MovieCard({ movie }) {
  return (
    <article className="movie-card">
      <MoviePoster movie={movie} size="w342" />
      <div className="card-meta card-info">
        <div className="card-title-row">
          <h3>{movie.title}</h3>
          <span className="movie-card-rating">★ {movie.rating}</span>
        </div>
        <div className="card-date-row">
          <p>{movie.date}</p>
          <span>{movie.runtime}</span>
        </div>
      </div>
      <div className="card-actions">
        <button data-href={detailUrl(movie)}>View</button>
        <button aria-label="Add to favourites">♡</button>
      </div>
    </article>
  );
}

export function PosterCard({ movie }) {
  return (
    <article className="poster-card" data-href={detailUrl(movie)}>
      <MoviePoster movie={movie} size="w342" />
      <div className="poster-card-info">
        <div className="card-title-row">
          <h3>{movie.title}</h3>
          <span className="movie-card-rating">★ {movie.rating}</span>
        </div>
        <div className="card-date-row">
          <p>{movie.date}</p>
          <span>{movie.runtime}</span>
        </div>
      </div>
    </article>
  );
}

export function SimilarMovieCard({ movie }) {
  return (
    <div className="similar" data-href={detailUrl(movie)}>
      <MoviePoster movie={movie} extra="similar-poster" size="w185" />
      <small>{movie.title}</small>
    </div>
  );
}

export function MovieMetaStars({ score }) {
  const n = Math.round(Number(score) / 2);
  return (
    <>
      <span className="movie-meta-stars">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className={i <= n ? 'on' : ''}>★</span>
        ))}
      </span>{' '}
      <strong>{score}</strong>
    </>
  );
}
