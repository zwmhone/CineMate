'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { fetchHomeMovies } from '@/lib/movies';
import { getContentBasedRecommendations } from '@/lib/recommendationEngine';
import { PosterCard } from '@/components/movie/MovieCard';
import SearchBar from '@/components/movie/SearchBar';

function HomeLoadingCard() {
  return (
    <article className="poster-card home-loading-card" aria-live="polite">
      <div className="poster-thumb loading-poster"></div>
      <div className="poster-card-info">
        <h3>Loading movies...</h3>
        <p>Please wait while CineMate loads the latest movie data.</p>
      </div>
    </article>
  );
}

function Section({ eyebrow, title, href = '/movies', children, id, extraClass = '', loading = false, emptyMessage = 'No movies are available right now.' }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className={`page-section home-showcase ${extraClass}`} id={id}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <a href={href}>See More</a>
      </div>
      <div className="poster-row">
        {loading ? Array.from({ length: 5 }).map((_, index) => <HomeLoadingCard key={`home-loading-${index}`} />) : hasContent ? children : <p className="meta home-empty-message">{emptyMessage}</p>}
      </div>
    </section>
  );
}

const emptyHomeMovies = {
  trending: [],
  popular: [],
  latest: [],
  recommended: [],
  latestTv: [],
};

export default function HomeContent() {
  const { isLoggedIn, user } = useAuth();
  const router = useRouter();
  const [homeMovies, setHomeMovies] = useState(emptyHomeMovies);
  const [loadingHome, setLoadingHome] = useState(true);
  const [homeError, setHomeError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadHomeMovies() {
      setLoadingHome(true);
      setHomeError('');

      try {
        const result = await fetchHomeMovies();
        let personalised = result.recommended || [];

        if (isLoggedIn && user?.id) {
          try {
            const recommendationResult = await getContentBasedRecommendations(user.id, { limit: 5 });
            if (recommendationResult.recommendations?.length) {
              personalised = recommendationResult.recommendations;
            }
          } catch (recommendationError) {
            console.warn(recommendationError.message);
          }
        }

        if (!active) return;
        setHomeMovies({
          trending: result.trending.slice(0, 5),
          popular: result.popular.slice(0, 5),
          latest: result.latest.slice(0, 5),
          recommended: personalised.slice(0, 5),
          latestTv: (result.latestTv || []).slice(0, 5),
        });
      } catch (error) {
        if (!active) return;
        setHomeMovies(emptyHomeMovies);
        setHomeError(error.message || 'Movie data could not be loaded right now.');
      } finally {
        if (active) setLoadingHome(false);
      }
    }

    loadHomeMovies();
    return () => {
      active = false;
    };
  }, [isLoggedIn, user?.id]);

  function searchFromHome(query) {
    if (query) router.push(`/movies?search=${encodeURIComponent(query)}`);
  }

  const emptyMessage = homeError || 'No movies are available right now.';

  return (
    <main>
      <section className="hero page-section" id="home">
        <div className="hero-copy reveal">
          <p className="eyebrow">Personalised Movie Discovery</p>
          <h1 className="gradient-text">Find your next<br />favourite movie</h1>
          <p className="hero-text">Search, save, rate and track films while CineMate learns what you like and suggests better choices based on your own taste.</p>
          <SearchBar variant="hero" onSearch={searchFromHome} suggestions />
        </div>
      </section>

      {isLoggedIn && (
        <Section id="recommended-home" eyebrow="Matched To Your Taste" title="Recommended For You" href="/recommendations" loading={loadingHome} emptyMessage={emptyMessage}>
          {homeMovies.recommended.map(movie => <PosterCard key={`${movie.mediaType || 'movie'}-${movie.id || movie.title}`} movie={movie} />)}
        </Section>
      )}

      <Section id="trending" eyebrow="Popular This Week" title="Trending" loading={loadingHome} emptyMessage={emptyMessage}>
        {homeMovies.trending.map(movie => <PosterCard key={`${movie.mediaType || 'movie'}-${movie.id || movie.title}`} movie={movie} />)}
      </Section>

      <Section id="popular-home" eyebrow="Audience Picks" title="Popular" loading={loadingHome} emptyMessage={emptyMessage}>
        {homeMovies.popular.map(movie => <PosterCard key={`${movie.mediaType || 'movie'}-${movie.id || movie.title}`} movie={movie} />)}
      </Section>

      <Section id="latest-movies-home" eyebrow="Fresh Films" title="Latest Movies" loading={loadingHome} emptyMessage={emptyMessage}>
        {homeMovies.latest.map(movie => <PosterCard key={`${movie.mediaType || 'movie'}-${movie.id || movie.title}`} movie={movie} />)}
      </Section>

      <Section id="latest-tv-home" eyebrow="New Episodes" title="Latest TV Shows" extraClass="home-last" loading={loadingHome} emptyMessage={emptyMessage}>
        {homeMovies.latestTv.map(movie => <PosterCard key={`tv-${movie.id || movie.title}`} movie={movie} />)}
      </Section>
    </main>
  );
}
