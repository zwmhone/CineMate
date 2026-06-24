'use client';

import { useState } from 'react';
import LoginPromptModal from '@/components/common/LoginPromptModal';
import { WATCH_STATUS_PLACEHOLDER, WATCH_STATES } from '@/constants/watchStates';
import useWatchStatus from '@/hooks/useWatchStatus';

export default function WatchStatusDropdown({ movie }) {
  const { status, loading, error, updateStatus, isLoggedIn } = useWatchStatus(movie);
  const [isOpen, setIsOpen] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');

  function stopShellHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
  }

  function handleToggle(event) {
    stopShellHandler(event);
    if (!isLoggedIn) {
      setIsOpen(false);
      setLoginMessage('You must be logged in to update watch status.');
      return;
    }
    setIsOpen(current => !current);
  }

  async function handleSelect(event, option) {
    stopShellHandler(event);
    const result = await updateStatus(option.value);
    setIsOpen(false);
    if (result.needsLogin) setLoginMessage('You must be logged in to update watch status.');
  }

  const label = loading ? 'Saving...' : status || WATCH_STATUS_PLACEHOLDER;
  const hasSavedStatus = status && status !== WATCH_STATUS_PLACEHOLDER;

  return (
    <>
      <div className={`custom-select watch-status-control${isOpen ? ' open' : ''}`}>
        <button
          type="button"
          className="custom-select-btn"
          onClick={handleToggle}
          disabled={loading}
          title={error || ''}
          aria-expanded={isOpen}
        >
          {label}
        </button>
        <div className="custom-select-options">
          <div
            className={`custom-option ${!hasSavedStatus ? 'active' : ''}`}
            data-status={WATCH_STATUS_PLACEHOLDER}
            onClick={event => handleSelect(event, { value: WATCH_STATUS_PLACEHOLDER })}
          >
            {hasSavedStatus ? 'Remove Status' : WATCH_STATUS_PLACEHOLDER}
          </div>
          {WATCH_STATES.map(option => (
            <div
              key={option.value}
              className={`custom-option ${status === option.label ? 'active' : ''}`}
              data-status={option.label}
              onClick={event => handleSelect(event, option)}
            >
              {option.label}
            </div>
          ))}
        </div>
      </div>
      <LoginPromptModal message={loginMessage} onClose={() => setLoginMessage('')} />
    </>
  );
}
