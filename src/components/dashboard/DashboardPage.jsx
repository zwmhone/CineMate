'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { listUserFavourites, listUserWatchStates } from '@/lib/userInteractions';
import { listUserRatings } from '@/lib/ratings';
import { getMovieDetails, getTvDetails } from '@/lib/tmdb';
import { getUserReviewCount } from '@/lib/dashboard';
import { getTmdbImageUrl } from '@/utils/imageUrl';
import DashboardSummary from './DashboardSummary';
import FavouriteList from './FavouriteList';
import WatchStateList from './WatchStateList';
import RatingList from './RatingList';
import DashboardCollections from './DashboardCollections';


function shortGenreLabel(label = '') {
  const text = String(label || '').trim();
  const replacements = {
    'Action & Adventure': 'Action',
    'Sci-Fi & Fantasy': 'Sci-Fi',
    'Science Fiction': 'Sci-Fi',
    'War & Politics': 'War',
    'Documentary': 'Doc',
  };
  return replacements[text] || text;
}

function buildGenreChartData(watchedItems = []) {
  const genreCounts = new Map();

  watchedItems.forEach(item => {
    const rawGenres = item?.movie?.genre || item?.movie?.genres || '';
    String(rawGenres)
      .split(/\s*[•,/]\s*/g)
      .map(genre => genre.trim())
      .filter(Boolean)
      .forEach(genre => {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      });
  });

  const rankedGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 7);

  const maxCount = Math.max(1, ...rankedGenres.map(([, count]) => count));

  return rankedGenres.map(([label, count]) => ({
    label,
    shortLabel: shortGenreLabel(label),
    count,
    height: `${Math.max(12, Math.round((count / maxCount) * 100))}%`,
  }));
}

function buildYAxisLabels(bars = []) {
  const maxCount = Math.max(1, ...bars.map(bar => bar.count || 0));
  const step = Math.max(1, Math.ceil(maxCount / 4));
  const top = step * 4;
  return [top, top - step, top - (step * 2), top - (step * 3), 0];
}

function GenreChart({ watchedItems = [] }) {
  const bars = buildGenreChartData(watchedItems);
  const yAxisLabels = buildYAxisLabels(bars);

  return (
    <section className="glass-panel genre-chart-panel reveal">
      <h3>Your Most Watched Genres</h3>
      {bars.length ? (
        <>
          <div className="chart-wrap">
            <div className="y-axis">
              {yAxisLabels.map(label => <span key={label}>{label}</span>)}
            </div>
            <div
              aria-label="Most watched genres chart"
              className="bar-chart dashboard-genre-bars"
              style={{ '--genre-bar-count': bars.length }}
            >
              {bars.map(bar => (
                <span key={bar.label} className="bar" style={{ '--h': bar.height }} title={`${bar.label}: ${bar.count}`}>
                  <strong>{bar.count}</strong>
                  <em>{bar.shortLabel}</em>
                </span>
              ))}
            </div>
          </div>
          <p className="chart-caption">Number of watched movies by genre</p>
        </>
      ) : (
        <p className="meta dashboard-empty-message">Mark movies as Watched to build your personal genre chart.</p>
      )}
    </section>
  );
}


function inferDashboardMediaType(movie = {}) {
  if (movie.mediaType === 'tv' || movie.media_type === 'tv') return 'tv';
  if (Number(movie.dbMovieId || movie.movie_id) < 0) return 'tv';
  const genres = String(movie.genre || movie.genres || '').toLowerCase();
  if (/sci-fi & fantasy|action & adventure|kids|war & politics|talk|soap|reality/.test(genres)) return 'tv';
  return 'movie';
}

function posterFromMovie(movie) {
  if (!movie) return '';
  const directPoster = movie.poster || movie.posterUrl || movie.poster_url;
  if (directPoster && (String(directPoster).startsWith('http') || String(directPoster).startsWith('/'))) {
    return directPoster;
  }

  const posterPath = movie.posterPath || movie.poster_path;
  return posterPath ? getTmdbImageUrl(posterPath, 'w342') : '';
}

function normaliseDashboardItem(item) {
  const movie = item.movie || item.movies || item;
  const createdAt = item.createdAt || item.created_at || null;
  const updatedAt = item.updatedAt || item.updated_at || createdAt;
  const storedId = Number(movie.dbMovieId ?? movie.movie_id);
  const rawId = movie.tmdbId || movie.tmdb_id || movie.id || movie.movie_id || movie.dbMovieId;
  const tmdbId = Math.abs(Number(rawId)) || rawId;
  const mediaType = inferDashboardMediaType(movie);

  return {
    status: item.status || 'Saved',
    rating: item.rating || item.ratingValue || item.rating_value || null,
    createdAt,
    updatedAt,
    sortDate: updatedAt || createdAt,
    movie: {
      id: tmdbId,
      tmdbId,
      dbMovieId: Number.isFinite(storedId) ? storedId : (mediaType === 'tv' && Number.isFinite(Number(tmdbId)) ? -Math.abs(Number(tmdbId)) : tmdbId),
      mediaType,
      title: movie.title || 'Untitled Movie',
      genre: movie.genre || movie.genres || (Array.isArray(movie.tags) ? movie.tags.join(' • ') : (mediaType === 'tv' ? 'TV Show' : 'Movie')),
      runtime: movie.runtime || 'Runtime TBA',
      poster: posterFromMovie(movie),
      posterPath: movie.posterPath || movie.poster_path || '',
    },
  };
}

async function hydrateMissingPosters(items) {
  const missingPosterItems = items.filter(item => item.movie?.tmdbId && !item.movie?.poster).slice(0, 20);
  if (!missingPosterItems.length) return items;

  const posterMap = new Map();
  const posterKey = item => `${item.movie?.mediaType || 'movie'}:${item.movie?.tmdbId}`;
  await Promise.allSettled(missingPosterItems.map(async item => {
    const details = item.movie?.mediaType === 'tv' ? await getTvDetails(item.movie.tmdbId) : await getMovieDetails(item.movie.tmdbId);
    if (details?.poster_path) {
      posterMap.set(posterKey(item), {
        poster: getTmdbImageUrl(details.poster_path, 'w342'),
        posterPath: details.poster_path,
      });
    }
  }));

  return items.map(item => {
    const hydrated = posterMap.get(posterKey(item));
    if (!hydrated) return item;
    return {
      ...item,
      movie: {
        ...item.movie,
        ...hydrated,
      },
    };
  });
}

function DashboardMovieSection({ title, loading, error, children }) {
  return (
    <section className="glass-panel reveal">
      <h3>{title}</h3>
      {loading && <p className="meta">Loading...</p>}
      {error && <p className="meta">{error}</p>}
      {!loading && children}
    </section>
  );
}

export default function DashboardPage() {
  const { user, ready } = useAuth();
  const [favourites, setFavourites] = useState([]);
  const [loadingFavourites, setLoadingFavourites] = useState(false);
  const [favouriteError, setFavouriteError] = useState('');
  const [watchStates, setWatchStates] = useState([]);
  const [loadingWatchStates, setLoadingWatchStates] = useState(false);
  const [watchStateError, setWatchStateError] = useState('');
  const [ratings, setRatings] = useState([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewCountError, setReviewCountError] = useState('');
  const [activeDashboardTab, setActiveDashboardTab] = useState('activity');

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'collections') {
      setActiveDashboardTab('collections');
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadFavourites() {
      if (!ready || !user?.id) return;
      setLoadingFavourites(true);
      setFavouriteError('');

      try {
        const data = await listUserFavourites(user.id);
        const normalised = data.map(normaliseDashboardItem);
        const hydrated = await hydrateMissingPosters(normalised);
        if (active) setFavourites(hydrated);
      } catch (error) {
        if (active) setFavouriteError(error.message || 'Could not load favourites.');
      } finally {
        if (active) setLoadingFavourites(false);
      }
    }

    async function loadWatchStates() {
      if (!ready || !user?.id) return;
      setLoadingWatchStates(true);
      setWatchStateError('');

      try {
        const data = await listUserWatchStates(user.id);
        const normalised = data.map(normaliseDashboardItem);
        const hydrated = await hydrateMissingPosters(normalised);
        if (active) setWatchStates(hydrated);
      } catch (error) {
        if (active) setWatchStateError(error.message || 'Could not load watch status list.');
      } finally {
        if (active) setLoadingWatchStates(false);
      }
    }

    async function loadRatings() {
      if (!ready || !user?.id) return;
      setLoadingRatings(true);
      setRatingError('');

      try {
        const data = await listUserRatings(user.id);
        const normalised = data.map(row => normaliseDashboardItem({ ...row, rating: row.rating_value }));
        const hydrated = await hydrateMissingPosters(normalised);
        if (active) setRatings(hydrated);
      } catch (error) {
        if (active) setRatingError(error.message || 'Could not load ratings.');
      } finally {
        if (active) setLoadingRatings(false);
      }
    }

    async function loadReviewCount() {
      if (!ready || !user?.id) return;
      setReviewCountError('');

      try {
        const count = await getUserReviewCount(user.id);
        if (active) setReviewCount(count);
      } catch (error) {
        if (active) {
          setReviewCount(0);
          setReviewCountError(error.message || 'Could not load review count.');
        }
      }
    }

    loadFavourites();
    loadWatchStates();
    loadRatings();
    loadReviewCount();
    return () => {
      active = false;
    };
  }, [ready, user?.id]);

  const wishlistItems = useMemo(() => watchStates.filter(item => item.status === 'Wishlist'), [watchStates]);
  const watchingItems = useMemo(() => watchStates.filter(item => item.status === 'Watching'), [watchStates]);
  const watchedItems = useMemo(() => watchStates.filter(item => item.status === 'Watched'), [watchStates]);
  const averageRating = useMemo(() => {
    if (!ratings.length) return '0.0';
    const total = ratings.reduce((sum, item) => sum + Number(item.rating || item.ratingValue || 0), 0);
    return (total / ratings.length).toFixed(1);
  }, [ratings]);

  return (
    <main>
      <section className="dashboard page-section" id="dashboard">
        <div className="section-heading dashboard-heading-with-tabs">
          <div>
            <p className="eyebrow">Your Activity</p>
            <h2>Your Dashboard</h2>
          </div>
          <div className="dashboard-tab-switch" role="tablist" aria-label="Dashboard sections">
            <button
              type="button"
              className={activeDashboardTab === 'activity' ? 'active' : ''}
              aria-selected={activeDashboardTab === 'activity'}
              onClick={() => setActiveDashboardTab('activity')}
            >
              Activity
            </button>
            <button
              type="button"
              className={activeDashboardTab === 'collections' ? 'active' : ''}
              aria-selected={activeDashboardTab === 'collections'}
              onClick={() => setActiveDashboardTab('collections')}
            >
              Collections
            </button>
          </div>
        </div>

        {activeDashboardTab === 'activity' ? (
          <div className="dashboard-grid">
            <DashboardSummary
              totalFavourites={favourites.length}
              watchedCount={watchedItems.length}
              averageRating={averageRating}
              totalReviews={reviewCount}
            />
            <GenreChart watchedItems={watchedItems} />
            {reviewCountError ? <p className="meta dashboard-dashboard-note">{reviewCountError}</p> : null}
            <DashboardMovieSection title="Wishlist" loading={loadingWatchStates} error={watchStateError}>
              <WatchStateList items={wishlistItems} emptyMessage="Your wishlist is empty. Add a movie to Wishlist when you want to watch it later." />
            </DashboardMovieSection>
            <DashboardMovieSection title="Your Favourites" loading={loadingFavourites} error={favouriteError}>
              <FavouriteList items={favourites} emptyMessage="You have not added any favourite movies yet. Tap Add To Favourite on a movie to save it here." />
            </DashboardMovieSection>
            <DashboardMovieSection title="Watching" loading={loadingWatchStates} error={watchStateError}>
              <WatchStateList items={watchingItems} emptyMessage="Nothing is marked as Watching yet. Choose Watching from a movie page to track it here." />
            </DashboardMovieSection>
            <DashboardMovieSection title="Watched" loading={loadingWatchStates} error={watchStateError}>
              <WatchStateList items={watchedItems} emptyMessage="No watched movies yet. Mark a movie as Watched after you finish it." />
            </DashboardMovieSection>
            <DashboardMovieSection title="Your Ratings" loading={loadingRatings} error={ratingError}>
              <RatingList items={ratings} emptyMessage="You have not rated any movies yet. Tap the stars on a movie page to add your rating." />
            </DashboardMovieSection>
          </div>
        ) : (
          <div className="dashboard-collections-tab">
            <DashboardCollections />
          </div>
        )}
      </section>
    </main>
  );
}
