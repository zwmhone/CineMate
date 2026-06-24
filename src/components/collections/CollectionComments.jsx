'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import useCollectionComments from '@/hooks/useCollectionComments';

const REPORT_REASONS = [
  'Hateful or abusive message',
  'Harassment or bullying',
  'Spam or misleading content',
  'Inappropriate language',
  'Other',
];

function mentionHandle(name = '') {
  const cleaned = String(name || 'user').trim().replace(/^@+/, '');
  const compact = cleaned.replace(/[^\p{L}\p{N}_-]+/gu, '');
  return compact || 'user';
}

function withReplyMention(text = '', name = '') {
  const cleanText = String(text || '').trim();
  if (!cleanText) return '';
  const handle = mentionHandle(name);
  if (cleanText.toLowerCase().startsWith(`@${handle.toLowerCase()}`)) return cleanText;
  return `@${handle} ${cleanText}`;
}

function splitReplyMention(text = '') {
  const value = String(text || '');
  const match = value.match(/^@([^\s]+)\s+([\s\S]*)$/);
  if (!match) return { mention: '', body: value };
  return { mention: match[1], body: match[2] };
}

function CollectionCommentText({ text = '' }) {
  const { mention, body } = splitReplyMention(text);
  return (
    <p>
      {mention && <span className="collection-comment-mention">@{mention}</span>}
      {body}
    </p>
  );
}

function avatarFor(comment) {
  const profile = comment?.profile || {};
  if (profile.profileImage) {
    return <img src={profile.profileImage} alt={`${profile.name} profile`} loading="lazy" />;
  }
  return <span aria-hidden="true">{profile.initial || 'C'}</span>;
}

function SortIcon({ active, direction }) {
  return <span aria-hidden="true" className="collection-comment-sort-icon">{active && direction === 'asc' ? '↑' : '↓'}</span>;
}

function ReactionButton({ type, active, count, disabled, onClick }) {
  return (
    <button
      type="button"
      className={`collection-comment-reaction ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${type === 'like' ? 'Like' : 'Dislike'} collection comment`}
    >
      {type === 'like' ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21h4V9H2v12Zm19-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L12.17 1 5.59 7.59C5.22 7.95 5 8.45 5 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2Z" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 3h-4v12h4V3ZM3 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L11.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2H8c-.83 0-1.54.5-1.84 1.22L3.14 11.27c-.09.23-.14.47-.14.73v2Z" /></svg>
      )}
      <span>{count}</span>
    </button>
  );
}

function CommentMenu({ canEdit, canDelete, canReport, onEdit, onDelete, onReport }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function close(event) {
      if (!menuRef.current || menuRef.current.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="collection-comment-menu" ref={menuRef}>
      <button type="button" className="collection-comment-menu-toggle" onClick={() => setOpen(value => !value)} aria-label="Open comment options">
        <span></span><span></span><span></span>
      </button>
      {open && (
        <div className="collection-comment-menu-popover">
          {canEdit && <button type="button" onClick={() => { setOpen(false); onEdit(); }}>Edit</button>}
          {canDelete && <button type="button" onClick={() => { setOpen(false); onDelete(); }}>Delete</button>}
          {canReport && <button type="button" onClick={() => { setOpen(false); onReport(); }}>Report</button>}
        </div>
      )}
    </div>
  );
}

function ReportModal({ comment, saving, onClose, onSubmit }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (!comment || typeof document === 'undefined') return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [comment]);

  if (!comment || typeof document === 'undefined') return null;

  return createPortal(
    <div className="collection-comment-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="collection-comment-report-modal" role="dialog" aria-modal="true" aria-labelledby="collection-report-title" onMouseDown={event => event.stopPropagation()}>
        <button type="button" className="collection-comment-modal-close" onClick={onClose} aria-label="Close report popup">×</button>
        <p className="eyebrow">Report comment</p>
        <h3 id="collection-report-title">Report this comment?</h3>
        <p>Tell the admin team why this collection comment should be reviewed.</p>
        <label>
          Reason
          <select value={reason} onChange={event => setReason(event.target.value)}>
            {REPORT_REASONS.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label>
          Optional details
          <textarea value={details} onChange={event => setDetails(event.target.value)} maxLength={600} placeholder="Add context for the admin team..." />
        </label>
        <div className="collection-comment-modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" disabled={saving} onClick={() => onSubmit(reason, details)}>{saving ? 'Sending...' : 'Send Report'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CommentComposer({ value, onChange, onSubmit, saving, maxLength, placeholder = 'Write something about this collection...', buttonLabel = 'Post Comment', compact = false, onCancel }) {
  return (
    <form className={`collection-comment-form ${compact ? 'compact' : ''}`} onSubmit={onSubmit}>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <div className="collection-comment-form-foot">
        <small>{value.trim().length}/{maxLength}</small>
        <div className="collection-comment-form-actions">
          {onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
          <button type="submit" disabled={saving || !value.trim()}>{saving ? 'Saving...' : buttonLabel}</button>
        </div>
      </div>
    </form>
  );
}

function CollectionCommentCard({ comment, replies = [], viewerId, isOwner, saving, reactingId, maxLength, onReply, onEdit, onDelete, onReact, onReport, isReply = false, repliesExpanded = false, onToggleReplies, onReplyPosted }) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text || '');

  const isAuthor = viewerId && viewerId === comment.userId;
  const canDelete = isOwner || isAuthor;
  const canEdit = isAuthor;
  const canReport = !isAuthor;

  async function submitReply(event) {
    event.preventDefault();
    const parentId = comment.parentId || comment.id;
    const posted = await onReply(withReplyMention(replyText, comment.profile?.name), parentId);
    if (posted) {
      setReplyText('');
      setReplying(false);
      if (typeof onReplyPosted === 'function') onReplyPosted(parentId);
    }
  }

  async function submitEdit(event) {
    event.preventDefault();
    const updated = await onEdit(comment.id, editText);
    if (updated) setEditing(false);
  }

  return (
    <article className={`collection-comment-card ${isReply ? 'reply' : ''}`}>
      <Link className="collection-comment-avatar" href={`/users/${comment.userId}`} aria-label={`Open ${comment.profile?.name || 'user'} profile`}>
        {avatarFor(comment)}
      </Link>
      <div className="collection-comment-body">
        <div className="collection-comment-topline">
          <div className="collection-comment-meta">
            <Link href={`/users/${comment.userId}`}>{comment.profile?.name || 'CineMate User'}</Link>
            {comment.dateLabel && <span>{comment.dateLabel}</span>}
            {comment.isEdited && <span>edited</span>}
          </div>
          <CommentMenu
            canEdit={canEdit}
            canDelete={canDelete}
            canReport={canReport}
            onEdit={() => { setEditText(comment.text || ''); setEditing(true); }}
            onDelete={() => onDelete(comment.id)}
            onReport={() => onReport(comment)}
          />
        </div>

        {editing ? (
          <CommentComposer
            value={editText}
            onChange={setEditText}
            onSubmit={submitEdit}
            saving={saving}
            maxLength={maxLength}
            placeholder="Edit your comment..."
            buttonLabel="Save Edit"
            compact
            onCancel={() => { setEditing(false); setEditText(comment.text || ''); }}
          />
        ) : (
          <CollectionCommentText text={comment.text} />
        )}

        <div className="collection-comment-actions-row">
          <ReactionButton
            type="like"
            active={comment.viewerReaction === 'like'}
            count={comment.likeCount || 0}
            disabled={reactingId === comment.id}
            onClick={() => onReact(comment.id, 'like')}
          />
          <ReactionButton
            type="dislike"
            active={comment.viewerReaction === 'dislike'}
            count={comment.dislikeCount || 0}
            disabled={reactingId === comment.id}
            onClick={() => onReact(comment.id, 'dislike')}
          />
          <button type="button" className="collection-comment-reply-btn" onClick={() => setReplying(value => !value)}>
            Reply
          </button>
        </div>

        {replying && (
          <CommentComposer
            value={replyText}
            onChange={setReplyText}
            onSubmit={submitReply}
            saving={saving}
            maxLength={maxLength}
            placeholder={`Reply to ${comment.profile?.name || 'this user'}...`}
            buttonLabel="Post Reply"
            compact
            onCancel={() => { setReplying(false); setReplyText(''); }}
          />
        )}

        {!isReply && replies.length > 0 && (
          <div className="collection-comment-replies-wrap">
            <button
              type="button"
              className="collection-comment-replies-toggle"
              onClick={() => onToggleReplies?.(comment.id)}
              aria-expanded={repliesExpanded}
            >
              {repliesExpanded ? `Hide replies (${replies.length})` : `Show replies (${replies.length})`}
            </button>
            {repliesExpanded && (
              <div className="collection-comment-replies">
                {replies.map(reply => (
                  <CollectionCommentCard
                    key={reply.id}
                    comment={reply}
                    replies={[]}
                    viewerId={viewerId}
                    isOwner={isOwner}
                    saving={saving}
                    reactingId={reactingId}
                    maxLength={maxLength}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReact={onReact}
                    onReport={onReport}
                    isReply
                    onReplyPosted={onReplyPosted}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function CollectionComments({ collectionId, collectionTitle = '', isOwner = false }) {
  const [text, setText] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [expandedReplyThreadIds, setExpandedReplyThreadIds] = useState(() => new Set());
  const {
    comments,
    parentComments,
    repliesByParent,
    loading,
    saving,
    reactingId,
    error,
    notice,
    viewerId,
    sortMode,
    sortDirection,
    maxLength,
    addComment,
    editComment,
    removeComment,
    reactToComment,
    reportComment,
    changeSort,
  } = useCollectionComments(collectionId);

  async function handleSubmit(event) {
    event.preventDefault();
    const posted = await addComment(text);
    if (posted) setText('');
  }

  function toggleReplyThread(commentId) {
    setExpandedReplyThreadIds(previous => {
      const next = new Set(previous);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }

  function showReplyThread(commentId) {
    setExpandedReplyThreadIds(previous => {
      const next = new Set(previous);
      next.add(commentId);
      return next;
    });
  }

  async function handleReportSubmit(reason, details) {
    if (!reportTarget) return;
    const sent = await reportComment(reportTarget.id, reason, details);
    if (sent) setReportTarget(null);
  }

  return (
    <section className="collection-comments-section glass-panel reveal" aria-labelledby="collection-comments-title">
      <div className="collection-comments-head">
        <div>
          <p className="eyebrow">Collection discussion</p>
          <h2 id="collection-comments-title">Comments</h2>
          <p className="meta">Share what you think about {collectionTitle ? `“${collectionTitle}”` : 'this collection'}.</p>
        </div>
        <span>{comments.length} comment{comments.length === 1 ? '' : 's'}</span>
      </div>

      <CommentComposer
        value={text}
        onChange={setText}
        onSubmit={handleSubmit}
        saving={saving}
        maxLength={maxLength}
      />

      <div className="collection-comment-sortbar" aria-label="Sort collection comments">
        <button type="button" className={sortMode === 'newest' ? 'active' : ''} onClick={() => changeSort('newest')}>
          Newest <SortIcon active={sortMode === 'newest'} direction={sortDirection} />
        </button>
        <button type="button" className={sortMode === 'liked' ? 'active' : ''} onClick={() => changeSort('liked')}>
          Most liked <SortIcon active={sortMode === 'liked'} direction={sortDirection} />
        </button>
      </div>

      {(error || notice) && <p className={`collection-comment-status ${error ? 'error' : ''}`}>{error || notice}</p>}

      {loading ? (
        <div className="collection-comment-empty">Loading comments...</div>
      ) : !parentComments.length ? (
        <div className="collection-comment-empty">No comments yet. Be the first to comment on this collection.</div>
      ) : (
        <div className="collection-comment-list">
          {parentComments.map(comment => (
            <CollectionCommentCard
              key={comment.id}
              comment={comment}
              replies={repliesByParent.get(comment.id) || []}
              viewerId={viewerId}
              isOwner={isOwner}
              saving={saving}
              reactingId={reactingId}
              maxLength={maxLength}
              onReply={addComment}
              onEdit={editComment}
              onDelete={removeComment}
              onReact={reactToComment}
              onReport={setReportTarget}
              repliesExpanded={expandedReplyThreadIds.has(comment.id)}
              onToggleReplies={toggleReplyThread}
              onReplyPosted={showReplyThread}
            />
          ))}
        </div>
      )}

      <ReportModal
        comment={reportTarget}
        saving={saving}
        onClose={() => setReportTarget(null)}
        onSubmit={handleReportSubmit}
      />
    </section>
  );
}
