'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { searchMovieSuggestions } from '@/lib/movies';
import SearchSuggestions from './SearchSuggestions';

export default function SearchBar({ variant = 'small', value = '', onSearch, suggestions = false, mediaType = 'all' }) {
  const router = useRouter();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const blurTimer = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    if (!suggestions) return undefined;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoadingSuggestions(false);
      return undefined;
    }

    let active = true;
    setLoadingSuggestions(true);

    const timer = setTimeout(async () => {
      const movies = await searchMovieSuggestions(trimmed, 7, mediaType);
      if (!active) return;
      setResults(movies);
      setLoadingSuggestions(false);
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, suggestions, mediaType]);

  function submit(event) {
    event.preventDefault();
    const trimmed = query.trim();
    if (onSearch) onSearch(trimmed);
  }

  function handleSelect(url) {
    setSuggestionsOpen(false);
    router.push(url);
  }

  function handleBlur() {
    blurTimer.current = setTimeout(() => setSuggestionsOpen(false), 120);
  }

  function handleFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    if (suggestions && query.trim().length >= 2) setSuggestionsOpen(true);
  }

  const formClass = variant === 'hero' ? 'hero-search' : 'small-search';
  const placeholder = variant === 'hero' ? 'Search for a movie, TV show, genre or keyword' : (mediaType === 'tv' ? 'Search for a TV show or title' : mediaType === 'movie' ? 'Search for a movie or title' : 'Search for a movie or TV show');

  return (
    <div className={`search-shell ${variant === 'hero' ? 'hero-search-shell' : 'small-search-shell'}`}>
      <form className={formClass} id={variant === 'hero' ? 'heroSearch' : undefined} onSubmit={submit}>
        <input
          aria-label={mediaType === 'tv' ? 'Search TV shows' : mediaType === 'movie' ? 'Search movies' : 'Search movies and TV shows'}
          name="query"
          placeholder={placeholder}
          type="search"
          value={query}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            if (suggestions && event.target.value.trim().length >= 2) setSuggestionsOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        <button type="submit">Search</button>
      </form>
      <SearchSuggestions
        open={suggestions && suggestionsOpen && query.trim().length >= 2}
        results={results}
        loading={loadingSuggestions}
        onSelect={handleSelect}
      />
    </div>
  );
}
