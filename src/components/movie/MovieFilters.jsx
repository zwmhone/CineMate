'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_MOVIE_FILTERS,
  getFilterLabel,
  getGenreOptions,
  MOVIE_FILTER_GROUPS,
  RATING_OPTIONS,
  RUNTIME_OPTIONS,
  SORT_OPTIONS,
  WATCH_STATUS_OPTIONS,
  YEAR_OPTIONS,
  MEDIA_TYPE_OPTIONS,
  COUNTRY_OPTIONS,
} from '@/constants/movieFilters';

function DropdownIcon() {
  return (
    <svg className="filter-select-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.5 9.25 12 14.75l5.5-5.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(option => option.value === value) || options[0];

  useEffect(() => {
    function handleClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }

    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div className="filter-field" ref={ref}>
      <label>{label}</label>
      <button
        type="button"
        className={`filter-select-button${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <span>{selected.label}</span>
        <DropdownIcon />
      </button>
      {open && (
        <div className={`filter-select-menu${options.length > 12 ? ' wide' : ''}`} role="listbox" tabIndex={-1}>
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'active' : ''}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { DEFAULT_MOVIE_FILTERS };

export default function MovieFilters({ filters = DEFAULT_MOVIE_FILTERS, onChange }) {
  const filterOptions = useMemo(() => ({
    mediaType: MEDIA_TYPE_OPTIONS,
    sort: SORT_OPTIONS,
    rating: RATING_OPTIONS,
    year: YEAR_OPTIONS,
    watchStatus: WATCH_STATUS_OPTIONS,
    genre: getGenreOptions(filters.mediaType),
    country: COUNTRY_OPTIONS,
    runtime: RUNTIME_OPTIONS,
  }), [filters.mediaType]);

  const activeFilters = useMemo(() => Object.entries(filters).filter(([key, value]) => {
    if (!value) return false;
    if (key === 'mediaType') return value !== DEFAULT_MOVIE_FILTERS.mediaType;
    return value !== 'any' && value !== 'default';
  }), [filters]);

  function updateFilter(key, value) {
    const nextFilters = { ...filters, [key]: value };
    if (key === 'mediaType') {
      nextFilters.genre = 'any';
      nextFilters.runtime = 'any';
      nextFilters.watchStatus = 'any';
    }
    onChange?.(nextFilters);
  }

  function clearFilter(key) {
    updateFilter(key, DEFAULT_MOVIE_FILTERS[key]);
  }

  function resetFilters() {
    onChange?.(DEFAULT_MOVIE_FILTERS);
  }

  return (
    <aside className="filters reveal">
      <div className="filter-panel-heading">
        <div>
          <p className="eyebrow">Refine</p>
          <h2>Filter titles</h2>
        </div>
        {activeFilters.length > 0 && (
          <button type="button" className="filter-reset-btn" onClick={resetFilters}>Reset</button>
        )}
      </div>

      <p className="filter-helper-text">Narrow movies and TV shows by content type, rating, year, country, genre, runtime, or your personal watch status.</p>

      {activeFilters.length > 0 && (
        <div className="active-filter-chips" aria-label="Active filters">
          {activeFilters.map(([key, value]) => (
            <button key={key} type="button" onClick={() => clearFilter(key)}>
              <span>{getFilterLabel(key, value, filters)}</span>
              <strong aria-hidden="true">×</strong>
            </button>
          ))}
        </div>
      )}

      <div className="filter-fields-grid">
        {MOVIE_FILTER_GROUPS.map(group => (
          <FilterSelect
            key={group.key}
            label={group.label}
            value={filters[group.key] || DEFAULT_MOVIE_FILTERS[group.key]}
            options={filterOptions[group.key]}
            onChange={value => updateFilter(group.key, value)}
          />
        ))}
      </div>
    </aside>
  );
}
