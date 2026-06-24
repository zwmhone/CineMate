'use client';

import { useState } from 'react';
import { detailUrl } from '@/lib/uiData';
import { saveWatchStatus } from '@/lib/userInteractions';
import { saveUserRating } from '@/lib/ratings';
import { saveRecommendationFeedback, RECOMMENDATION_FEEDBACK } from '@/lib/recommendationFeedback';
import { useAuth } from '@/lib/AuthContext';
import { WATCH_STATES, WATCH_STATUS_PLACEHOLDER } from '@/constants/watchStates';
import { MoviePoster } from '@/components/movie/MovieCard';
import RecommendationReason from './RecommendationReason';

function TagList({ tags = [] }) {
  const visibleTags = (Array.isArray(tags) ? tags : []).slice(0, 4);
  if (!visibleTags.length) return null;
  return <div className="tags">{visibleTags.map(tag => <span key={tag}>{tag}</span>)}</div>;
}

function notifyLogin(message) {
  window.dispatchEvent(new CustomEvent('cinemate:require-login', { detail: message }));
}

export function MatchCard({ movie, index = 0 }) {
  const [showDescription, setShowDescription] = useState(false);
  const description = movie.overview || movie.description || '';

  function toggleDescription(event) {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
    setShowDescription(open => !open);
  }

  return (
    <article className="match-card recommendation-match-card" data-href={detailUrl(movie)}>
      <MoviePoster movie={movie} size="w342" />
      <div className="match-content">
        <div className="match-percent">{movie.matchPercent || 70}% match</div>
        <div className="match-title-row">
          <h3>{movie.title}</h3>
          <span className="match-rating">★ {movie.rating || 'N/A'}</span>
        </div>
        <p>{movie.date || movie.releaseYear || 'Date TBA'}<span style={{ float: 'right' }}>{movie.runtime || 'Runtime TBA'}</span></p>
        <RecommendationReason>{movie.reason || 'Recommended because it matches your saved preferences.'}</RecommendationReason>
        {description && (
          <div className="recommendation-description-block" data-no-card-nav="true">
            <button type="button" className="recommendation-description-toggle" onClick={toggleDescription}>
              {showDescription ? 'Hide description' : 'See description'}
            </button>
            {showDescription && <p className="recommendation-description-text">{description}</p>}
          </div>
        )}
        <TagList tags={movie.tags} />
      </div>
    </article>
  );
}

export default function RecommendationCard({ movie, index = 0, onHide }) {
  const { user } = useAuth();
  const [savingAction, setSavingAction] = useState('');
  const [message, setMessage] = useState('');
  const [showRatingPicker, setShowRatingPicker] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  function finishAndHide(nextMessage) {
    setMessage(nextMessage);
    window.setTimeout(() => onHide?.(movie), 300);
  }

  async function handleRatingToggle(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!user?.id) {
      notifyLogin('Please log in to rate recommendations.');
      return;
    }

    setShowRatingPicker(open => !open);
    setShowStatusMenu(false);
    setMessage('');
  }

  async function handleRatingValue(event, ratingValue) {
    event.preventDefault();
    event.stopPropagation();

    if (!user?.id) {
      notifyLogin('Please log in to rate recommendations.');
      return;
    }

    setSavingAction(`rating-${ratingValue}`);
    setMessage('');
    try {
      await saveUserRating(movie, user.id, ratingValue);
      finishAndHide(`Rated ${ratingValue}/5 and removed from this list.`);
    } catch (error) {
      setMessage(error.message || 'Could not save this rating.');
    } finally {
      setSavingAction('');
    }
  }

  function handleStatusToggle(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!user?.id) {
      notifyLogin('Please log in to update watch status.');
      return;
    }

    setShowStatusMenu(open => !open);
    setShowRatingPicker(false);
    setMessage('');
  }

  async function handleStatusValue(event, nextStatus) {
    event.preventDefault();
    event.stopPropagation();

    if (!nextStatus) return;

    if (!user?.id) {
      notifyLogin('Please log in to update watch status.');
      return;
    }

    setSavingAction(nextStatus);
    setMessage('');
    try {
      await saveWatchStatus(movie, user.id, nextStatus);
      const label = WATCH_STATES.find(item => item.value === nextStatus)?.label || 'Watch status';
      finishAndHide(`${label} saved and removed from this list.`);
    } catch (error) {
      setMessage(error.message || 'Could not update watch status.');
    } finally {
      setSavingAction('');
      setShowStatusMenu(false);
    }
  }

  async function handleNotInterested(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!user?.id) {
      notifyLogin('Please log in to save recommendation feedback.');
      return;
    }

    setSavingAction('not-interested');
    setMessage('');
    try {
      await saveRecommendationFeedback(movie, user.id, RECOMMENDATION_FEEDBACK.NOT_INTERESTED);
      finishAndHide('Marked as not interested and removed from this list.');
    } catch (error) {
      setMessage(error.message || 'Could not save recommendation feedback.');
    } finally {
      setSavingAction('');
    }
  }

  const isSaving = Boolean(savingAction);

  return (
    <article className="rec-item recommendation-item">
      <div className="rank">{index + 1}</div>
      <div data-href={detailUrl(movie)}>
        <MoviePoster movie={movie} extra="recommendation-poster" size="w185" />
      </div>
      <div className="recommendation-copy">
        <div className="rec-title-row">
          <h3>{movie.title}</h3>
          <span className="rec-rating">★ {movie.rating || 'N/A'}</span>
        </div>
        <div className="recommendation-meta-row">
          <span>{movie.mediaType === 'tv' ? 'TV Show' : 'Movie'}</span>
          <span>{movie.date || movie.releaseYear || 'Date TBA'}</span>
          <span>{movie.runtime || 'Runtime TBA'}</span>
          <strong>{movie.matchPercent || 80}% match</strong>
        </div>
        <RecommendationReason>{movie.reason || 'Recommended because it matches your saved genres, ratings and watch history.'}</RecommendationReason>
        <TagList tags={movie.tags} />
        {message && <p className="meta recommendation-action-message">{message}</p>}
      </div>
      <div className="rec-actions recommendation-actions">
        <button type="button" data-href={detailUrl(movie)}>View</button>
        <div className="recommendation-rating-action">
          <button type="button" className="recommendation-rate-toggle" onClick={handleRatingToggle} disabled={isSaving}>
            {savingAction.startsWith('rating') ? 'Saving...' : '★ Rate'}
          </button>
          {showRatingPicker && (
            <div className="recommendation-rating-picker" aria-label="Rate this recommendation">
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={event => handleRatingValue(event, value)}
                  disabled={isSaving}
                  aria-label={`Rate ${value} out of 5`}
                >
                  ★<span>{value}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="recommendation-status-action">
          <button type="button" className="recommendation-status-toggle" onClick={handleStatusToggle} disabled={isSaving}>
            {isSaving && !savingAction.startsWith('rating') ? 'Saving...' : WATCH_STATUS_PLACEHOLDER}
          </button>
          {showStatusMenu && (
            <div className="recommendation-status-menu" role="menu" aria-label="Choose watch status">
              {WATCH_STATES.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={event => handleStatusValue(event, option.value)}
                  disabled={isSaving}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="recommendation-not-interested-btn"
          onClick={handleNotInterested}
          disabled={isSaving}
        >
          {savingAction === 'not-interested' ? 'Saving...' : 'Not Interested'}
        </button>
      </div>
    </article>
  );
}
