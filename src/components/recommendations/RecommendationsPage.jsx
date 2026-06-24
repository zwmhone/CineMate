'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useRecommendations from '@/hooks/useRecommendations';
import RecommendationCard, { MatchCard } from './RecommendationCard';
import RecommendationSection from './RecommendationSection';

function RecommendationLoading() {
  return (
    <div className="recommendation-empty-panel glass-panel">
      <p className="eyebrow">Building profile</p>
      <h3>Finding your matches...</h3>
      <p className="meta">CineMate is reading your favourites, ratings and watch status to build content-based recommendations.</p>
    </div>
  );
}

function TasteProfile({ profile }) {
  const topGenres = profile?.topGenres || [];
  const signals = profile?.signals || {};

  return (
    <section className="recommendation-profile glass-panel">
      <div>
        <p className="eyebrow">Taste Profile</p>
        <h3>Your recommendation signals</h3>
        <p className="meta">Generated from favourites, ratings and watch status.</p>
      </div>
      <div className="recommendation-signal-grid">
        <span><strong>{signals.favourites || 0}</strong> Favourites</span>
        <span><strong>{signals.ratings || 0}</strong> Ratings</span>
        <span><strong>{signals.watched || 0}</strong> Watched</span>
      </div>
      <div className="tags recommendation-profile-tags">
        {topGenres.length ? topGenres.slice(0, 6).map(genre => <span key={genre.label}>{genre.label}</span>) : <span>Add activity to build genres</span>}
      </div>
    </section>
  );
}

function normaliseGenre(value = '') {
  return String(value || '').trim().toLowerCase();
}

function recommendationKey(movie = {}) {
  return `${movie.mediaType}-${movie.tmdbId}`;
}

function seededValue(key, seed) {
  const text = `${seed}-${key}`;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function RecommendationFilters({ genres, selectedGenre, onSelectGenre, onSurprise }) {
  if (!genres.length) return null;

  return (
    <section className="recommendation-mood-panel glass-panel" aria-label="Filter recommendations by genre">
      <div className="recommendation-mood-header">
        <div>
          <p className="eyebrow">Genre Filter</p>
          <h3>Choose what you feel like watching</h3>
          <p className="meta">Filter your personalised recommendations without resetting your taste profile.</p>
        </div>
        <button type="button" className="recommendation-surprise-btn" onClick={onSurprise}>Surprise Me</button>
      </div>
      <div className="recommendation-genre-pills">
        <button
          type="button"
          className={selectedGenre === 'All' ? 'active' : ''}
          onClick={() => onSelectGenre('All')}
        >
          All
        </button>
        {genres.map(genre => (
          <button
            key={genre}
            type="button"
            className={selectedGenre === genre ? 'active' : ''}
            onClick={() => onSelectGenre(genre)}
          >
            {genre}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function RecommendationsPage() {
  const { user } = useAuth();
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set());
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [surprisePage, setSurprisePage] = useState(0);
  const { recommendations, profile, loading, error, message } = useRecommendations(user?.id, 120, selectedGenre);

  function hideRecommendation(movie) {
    const key = recommendationKey(movie);
    setHiddenKeys(previous => new Set([...previous, key]));
  }

  const genreOptions = useMemo(() => {
    const counts = new Map();
    (profile?.topGenres || []).forEach((genre, index) => {
      const label = String(genre?.label || '').trim();
      if (!label) return;
      counts.set(label, (counts.get(label) || 0) + Math.max(8 - index, 1));
    });
    recommendations.forEach(movie => {
      (movie.tags || []).forEach(tag => {
        const label = String(tag || '').trim();
        if (!label) return;
        counts.set(label, (counts.get(label) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([genre]) => genre);
  }, [profile, recommendations]);

  const activeRecommendations = useMemo(() => {
    const unhidden = recommendations.filter(movie => !hiddenKeys.has(recommendationKey(movie)));
    const filtered = selectedGenre === 'All'
      ? unhidden
      : unhidden.filter(movie => (movie.tags || []).some(tag => normaliseGenre(tag) === normaliseGenre(selectedGenre)));

    if (!surprisePage) return filtered;

    return [...filtered].sort((left, right) => (
      seededValue(recommendationKey(left), `${selectedGenre}-${surprisePage}`) - seededValue(recommendationKey(right), `${selectedGenre}-${surprisePage}`)
    ));
  }, [recommendations, hiddenKeys, selectedGenre, surprisePage]);

  const visibleRecommendations = useMemo(() => {
    if (!activeRecommendations.length) return [];
    const start = (surprisePage * 12) % activeRecommendations.length;
    const nextBatch = activeRecommendations.slice(start, start + 12);
    if (nextBatch.length >= 12 || activeRecommendations.length < 12) return nextBatch;
    return [...nextBatch, ...activeRecommendations.slice(0, 12 - nextBatch.length)];
  }, [activeRecommendations, surprisePage]);
  const visibleTopMatches = visibleRecommendations.slice(0, 3);

  function handleGenreSelect(nextGenre) {
    setSelectedGenre(nextGenre);
    setSurprisePage(0);
  }

  function handleSurprise() {
    setSurprisePage(previous => previous + 1);
  }

  return (
    <main>
      <section className="recommendations page-section" id="recommendations">
        <RecommendationSection eyebrow="Content-Based Filtering" title="Personalised Matches">
          <TasteProfile profile={profile} />
        </RecommendationSection>

        {loading && <RecommendationLoading />}
        {error && <div className="recommendation-empty-panel glass-panel"><p className="meta">{error}</p></div>}
        {!loading && !error && recommendations.length > 0 && (
          <RecommendationFilters
            genres={genreOptions}
            selectedGenre={selectedGenre}
            onSelectGenre={handleGenreSelect}
            onSurprise={handleSurprise}
          />
        )}
        {!loading && !error && message && !visibleRecommendations.length && selectedGenre === 'All' && (
          <div className="recommendation-empty-panel glass-panel">
            <p className="eyebrow">More activity needed</p>
            <h3>No personalised recommendations yet</h3>
            <p className="meta">{message}</p>
          </div>
        )}
        {!loading && !error && !visibleRecommendations.length && selectedGenre !== 'All' && (
          <div className="recommendation-empty-panel glass-panel">
            <p className="eyebrow">No {selectedGenre} matches yet</p>
            <h3>Try another mood filter</h3>
            <p className="meta">CineMate did not find enough personalised titles in this genre yet. Add more ratings or switch back to All.</p>
          </div>
        )}

        {!loading && !error && visibleTopMatches.length > 0 && (
          <div className="match-cards" id="matchCards">
            {visibleTopMatches.map((movie, index) => <MatchCard key={recommendationKey(movie)} movie={movie} index={index} />)}
          </div>
        )}

        {!loading && !error && visibleRecommendations.length > 0 && (
          <RecommendationSection eyebrow="Ranked For Your Taste" title={selectedGenre === 'All' ? 'Recommended Titles' : `${selectedGenre} Recommendations`} className="second">
            <div className="recommendation-list" id="recommendationList">
              {visibleRecommendations.map((movie, index) => <RecommendationCard key={recommendationKey(movie)} movie={movie} index={index} onHide={hideRecommendation} />)}
            </div>
          </RecommendationSection>
        )}
      </section>
    </main>
  );
}
