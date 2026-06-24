'use client';

import { useState } from 'react';

export default function CommentBox({ onSubmit, saving = false, isLoggedIn = false, onRequireLogin }) {
  const [comment, setComment] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!isLoggedIn) {
      if (typeof onRequireLogin === 'function') onRequireLogin('You must be logged in to comment.');
      return;
    }

    const text = comment.trim();
    if (!text || typeof onSubmit !== 'function') return;

    const success = await onSubmit(text);
    if (success !== false) setComment('');
  }

  return (
    <form className="comment-box" onSubmit={handleSubmit}>
      <textarea
        value={comment}
        onChange={event => setComment(event.target.value)}
        placeholder="Write a comment..."
        aria-label="Write a comment"
        rows={3}
      />
      <button type="submit" disabled={saving || !comment.trim()} onClick={event => event.stopPropagation()}>{saving ? 'Posting...' : 'Post'}</button>
    </form>
  );
}
