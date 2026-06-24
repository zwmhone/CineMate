'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function LoginPromptModal({ message, onClose }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!message) return undefined;

    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [message, onClose]);

  if (!mounted || !message) return null;

  function stopPageScroll(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  return createPortal(
    <div
      className="login-popup-root show"
      role="presentation"
      onWheel={stopPageScroll}
      onTouchMove={stopPageScroll}
    >
      <div
        className="login-popup-backdrop show"
        aria-hidden="true"
        onMouseDown={event => {
          event.preventDefault();
          onClose();
        }}
        onClick={onClose}
      ></div>
      <div
        className="login-popup show"
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        onMouseDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
        onWheel={event => event.stopPropagation()}
        onTouchMove={event => event.stopPropagation()}
      >
        <button
          type="button"
          className="login-popup-close"
          aria-label="Close popup"
          onMouseDown={event => {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
        <strong>{message}</strong>
        <a className="login-popup-action" href="/login" onClick={onClose}>
          Sign Up / Login
        </a>
      </div>
    </div>,
    document.body,
  );
}
