'use client';

function ReactionIcon({ type }) {
  if (type === 'like') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 10.5v9h-3v-9h3Zm2.4 9h6.9c1.1 0 2.05-.75 2.32-1.82l1.2-4.8a2.08 2.08 0 0 0-2.02-2.58h-4.15l.65-3.08c.08-.42-.04-.86-.34-1.17l-.72-.72-4.84 5.2v9.97Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M17 13.5v-9h3v9h-3Zm-2.4-9H7.7c-1.1 0-2.05.75-2.32 1.82l-1.2 4.8a2.08 2.08 0 0 0 2.02 2.58h4.15l-.65 3.08c-.08.42.04.86.34 1.17l.72.72 4.84-5.2V4.5Z" />
    </svg>
  );
}

export default function CommentReactionButtons({ comment, saving = false, onReact }) {
  const likes = Number(comment?.likes || 0);
  const dislikes = Number(comment?.dislikes || 0);
  const userReaction = comment?.userReaction || null;
  const canReact = Boolean(comment?.canReact);

  async function handleClick(type) {
    if (typeof onReact !== 'function') return;
    await onReact(comment.id, type);
  }

  return (
    <div className="comment-reactions" aria-label="Comment reactions">
      <button
        type="button"
        className={`comment-reaction-btn${userReaction === 'like' ? ' active' : ''}`}
        disabled={saving}
        aria-pressed={userReaction === 'like'}
        aria-label={canReact ? 'Like comment' : 'Log in to like this comment'}
        onClick={event => { event.stopPropagation(); handleClick('like'); }}
      >
        <ReactionIcon type="like" />
        <span>{likes}</span>
      </button>
      <button
        type="button"
        className={`comment-reaction-btn${userReaction === 'dislike' ? ' active' : ''}`}
        disabled={saving}
        aria-pressed={userReaction === 'dislike'}
        aria-label={canReact ? 'Dislike comment' : 'Log in to dislike this comment'}
        onClick={event => { event.stopPropagation(); handleClick('dislike'); }}
      >
        <ReactionIcon type="dislike" />
        <span>{dislikes}</span>
      </button>
    </div>
  );
}
