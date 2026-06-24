'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalScrollLock from '@/hooks/useModalScrollLock';
import CommentReactionButtons from '@/components/comments/CommentReactionButtons';
import LoginPromptModal from '@/components/common/LoginPromptModal';

function CommentModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

function ReviewAvatar({ comment }) {
  const author = comment?.author || 'CineMate User';
  const initial = author.trim().charAt(0).toUpperCase() || 'C';

  if (comment?.profileImage) {
    return <img className="review-avatar" src={comment.profileImage} alt={`${author} profile`} loading="lazy" />;
  }

  return <span className="review-avatar review-avatar-fallback" aria-hidden="true">{initial}</span>;
}

function PublicProfileLink({ comment, children, className = '' }) {
  if (!comment?.userId) return children;
  return (
    <a className={className || undefined} href={`/users/${comment.userId}`} onClick={event => event.stopPropagation()}>
      {children}
    </a>
  );
}

function ReviewStars({ rating = 0 }) {
  const value = Number(rating || 0);
  if (!value) return <span className="review-stars-empty" aria-hidden="true"></span>;

  return (
    <span className="review-stars" aria-label={`User rating ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(index => (
        <span key={index} className={index <= value ? 'on' : ''}>★</span>
      ))}
    </span>
  );
}

function formatReviewDate(value) {
  if (!value) return 'just now';

  try {
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return 'recently';
  }
}

function needsTextToggle(text = '') {
  const value = String(text || '');
  return value.length > 160 || value.split(/\r?\n/).length > 3;
}

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

function ReviewText({ text = '', clamped = false }) {
  const { mention, body } = splitReplyMention(text);
  return (
    <p className={`review-text${clamped ? ' is-clamped' : ''}`}>
      {mention && <span className="review-reply-mention">@{mention}</span>}
      {body}
    </p>
  );
}

function tabLabel(tab, counts) {
  if (tab === 'rated') return `Rated Reviews (${counts.rated})`;
  if (tab === 'comments') return `Comments (${counts.normal})`;
  return `All Reviews (${counts.all})`;
}

export default function CommentList({ comments = [], loading = false, saving = false, onEdit, onDelete, onReport, onReact, onReply }) {
  const [activeTab, setActiveTab] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [expandedTextIds, setExpandedTextIds] = useState(() => new Set());
  const [confirmComment, setConfirmComment] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [reportComment, setReportComment] = useState(null);
  const [reportReason, setReportReason] = useState('Hateful or abusive message');
  const [reportDetails, setReportDetails] = useState('');
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  const [reportNotice, setReportNotice] = useState('');
  const [reactionNotice, setReactionNotice] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [replyParentId, setReplyParentId] = useState(null);
  const [replyAnchorId, setReplyAnchorId] = useState(null);
  const [replyToName, setReplyToName] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [expandedReplyThreadIds, setExpandedReplyThreadIds] = useState(() => new Set());

  useModalScrollLock(Boolean(reportComment || confirmComment));

  const topLevelComments = useMemo(() => comments.filter(comment => !comment.parentId), [comments]);

  const repliesByParent = useMemo(() => {
    const map = new Map();
    comments.filter(comment => comment.parentId).forEach(reply => {
      const key = reply.parentId;
      const list = map.get(key) || [];
      list.push(reply);
      map.set(key, list);
    });
    return map;
  }, [comments]);

  const counts = useMemo(() => ({
    all: topLevelComments.length,
    rated: topLevelComments.filter(comment => comment.isRatingReview).length,
    normal: topLevelComments.filter(comment => !comment.isRatingReview).length,
  }), [topLevelComments]);

  const filteredComments = useMemo(() => {
    if (activeTab === 'rated') return topLevelComments.filter(comment => comment.isRatingReview);
    if (activeTab === 'comments') return topLevelComments.filter(comment => !comment.isRatingReview);
    return topLevelComments;
  }, [activeTab, topLevelComments]);

  if (loading) {
    return (
      <div className="reviews">
        <p className="meta detail-empty-message">Loading reviews...</p>
      </div>
    );
  }

  if (!comments.length) {
    return (
      <div className="reviews">
        <p className="meta detail-empty-message">No reviews have been posted for this movie yet.</p>
      </div>
    );
  }

  const visibleComments = showAll ? filteredComments : filteredComments.slice(0, 3);

  function handleTabChange(tab) {
    setActiveTab(tab);
    setShowAll(false);
    setEditingId(null);
    setDraft('');
    setOpenMenuId(null);
    setReplyParentId(null);
    setReplyAnchorId(null);
    setReplyDraft('');
    setReplyToName('');
  }

  function toggleReplyThread(commentId) {
    setExpandedReplyThreadIds(previous => {
      const next = new Set(previous);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }

  function sortRepliesOldestFirst(replies = []) {
    return [...replies].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  }

  function toggleText(commentId) {
    setExpandedTextIds(previous => {
      const next = new Set(previous);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }

  async function handleSave(comment) {
    const text = draft.trim();
    if (!text || typeof onEdit !== 'function' || comment.isRatingReview) return;

    await onEdit(comment.id, text);
    setEditingId(null);
    setDraft('');
  }

  async function confirmDelete() {
    if (!confirmComment || typeof onDelete !== 'function') return;
    await onDelete(confirmComment);
    setConfirmComment(null);
  }

  function canShowMenu(comment) {
    return Boolean(comment.canEdit || comment.canRemoveReviewText || comment.canReport);
  }

  async function confirmReport() {
    if (!reportComment || typeof onReport !== 'function') return;
    const result = await onReport(reportComment.id, reportReason, reportDetails);

    if (result === true) {
      setReportComment(null);
      setReportReason('Hateful or abusive message');
      setReportDetails('');
      setReportDropdownOpen(false);
      setReportNotice('Sent to the admin team.');
      window.setTimeout(() => setReportNotice(''), 3200);
      return;
    }

    if (typeof result === 'string') {
      setReportNotice(result);
    }
  }

  async function handleReact(commentId, reactionType) {
    if (typeof onReact !== 'function') return;

    try {
      await onReact(commentId, reactionType);
    } catch (err) {
      const message = err?.message || 'Could not save your reaction.';
      if (message.toLowerCase().includes('log in')) {
        setLoginMessage(message);
        return;
      }
      setReactionNotice(message);
      window.setTimeout(() => setReactionNotice(''), 3200);
    }
  }

  function startReply(parentId, authorName = 'this user', anchorId = parentId) {
    setReplyParentId(parentId);
    setReplyAnchorId(anchorId);
    setReplyToName(authorName || 'this user');
    setReplyDraft('');
    setOpenMenuId(null);
  }

  async function submitReply() {
    if (typeof onReply !== 'function' || !replyParentId) return;
    const rawText = replyDraft.trim();
    if (!rawText) return;
    const text = withReplyMention(rawText, replyToName);

    try {
      await onReply(replyParentId, text);
      setExpandedReplyThreadIds(previous => {
        const next = new Set(previous);
        next.add(replyParentId);
        return next;
      });
      setReplyParentId(null);
      setReplyAnchorId(null);
      setReplyToName('');
      setReplyDraft('');
    } catch (err) {
      const message = err?.message || 'Could not post your reply.';
      if (message.toLowerCase().includes('log in')) {
        setLoginMessage(message);
        return;
      }
      setReactionNotice(message);
      window.setTimeout(() => setReactionNotice(''), 3200);
    }
  }

  return (
    <>
      <div className="review-tabs" role="tablist" aria-label="Review filter">
        {['all', 'rated', 'comments'].map(tab => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => handleTabChange(tab)}
          >
            {tabLabel(tab, counts)}
          </button>
        ))}
      </div>

      <div className="reviews" onClick={() => setOpenMenuId(null)}>
        {visibleComments.length ? visibleComments.map(comment => {
          const isEditing = editingId === comment.id;
          const isExpanded = expandedTextIds.has(comment.id);
          const canToggleText = needsTextToggle(comment.text);
          const menuOpen = openMenuId === comment.id;

          return (
            <article key={comment.id || `${comment.userId}-${comment.createdAt}`} className="review-card">
              <div className="review-head">
                <div className="review-author">
                  <PublicProfileLink comment={comment} className="review-avatar-link">
                    <ReviewAvatar comment={comment} />
                  </PublicProfileLink>
                  <strong className="review-meta">
                    <PublicProfileLink comment={comment} className="review-name review-name-link">
                      {comment.author || 'CineMate User'}
                    </PublicProfileLink>
                    <span className="review-separator">•</span>
                    <span className="review-date">{formatReviewDate(comment.createdAt)}</span>
                  </strong>
                </div>
                <ReviewStars rating={comment.rating} />
              </div>

              {isEditing ? (
                <div className="review-edit-box">
                  <textarea
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    aria-label="Edit comment"
                  />
                  <div className="review-actions">
                    <button type="button" disabled={saving || !draft.trim()} onClick={() => handleSave(comment)}>Save</button>
                    <button type="button" disabled={saving} onClick={() => { setEditingId(null); setDraft(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <ReviewText text={comment.text} clamped={canToggleText && !isExpanded} />
                  {canToggleText && (
                    <button type="button" className="review-text-toggle" onClick={event => { event.stopPropagation(); toggleText(comment.id); }}>
                      {isExpanded ? 'Show Less' : 'Show More'}
                    </button>
                  )}
                  <div className="review-inline-actions">
                    <CommentReactionButtons comment={comment} saving={saving} onReact={handleReact} />
                    <button type="button" className="review-reply-btn" disabled={saving} onClick={event => { event.stopPropagation(); startReply(comment.id, comment.author, comment.id); }}>Reply</button>
                  </div>
                  {replyAnchorId === comment.id && (
                    <div className="review-reply-form" onClick={event => event.stopPropagation()}>
                      <textarea
                        value={replyDraft}
                        onChange={event => setReplyDraft(event.target.value)}
                        placeholder={`Reply to ${replyToName}...`}
                        aria-label={`Reply to ${replyToName}`}
                      />
                      <div className="review-reply-actions">
                        <button type="button" disabled={saving} onClick={() => { setReplyParentId(null); setReplyAnchorId(null); setReplyDraft(''); setReplyToName(''); }}>Cancel</button>
                        <button type="button" className="primary" disabled={saving || !replyDraft.trim()} onClick={submitReply}>{saving ? 'Posting...' : 'Post Reply'}</button>
                      </div>
                    </div>
                  )}
                  {canShowMenu(comment) && (
                    <div className="review-menu-wrap" onClick={event => event.stopPropagation()}>
                      <button
                        type="button"
                        className="review-menu-trigger"
                        aria-label="Review options"
                        aria-expanded={menuOpen}
                        disabled={saving}
                        onClick={() => setOpenMenuId(menuOpen ? null : comment.id)}
                      >
                        ⋮
                      </button>
                      {menuOpen && (
                        <div className="review-menu" role="menu">
                          {comment.canEdit && !comment.isRatingReview && (
                            <button
                              type="button"
                              role="menuitem"
                              disabled={saving}
                              onClick={() => {
                                setEditingId(comment.id);
                                setDraft(comment.text || '');
                                setOpenMenuId(null);
                              }}
                            >
                              Edit
                            </button>
                          )}
                          {comment.canReport && (
                            <button
                              type="button"
                              role="menuitem"
                              disabled={saving}
                              onClick={() => {
                                setReportNotice('');
                                setReportComment(comment);
                                setOpenMenuId(null);
                              }}
                            >
                              Report
                            </button>
                          )}
                          {(comment.canEdit || comment.canRemoveReviewText) && (
                            <button
                              type="button"
                              role="menuitem"
                              className="danger"
                              disabled={saving}
                              onClick={() => {
                                setConfirmComment(comment);
                                setOpenMenuId(null);
                              }}
                            >
                              {comment.isRatingReview ? 'Remove Review Text' : 'Delete'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            {(() => {
              const replies = sortRepliesOldestFirst(repliesByParent.get(comment.id) || []);
              if (!replies.length) return null;
              const repliesExpanded = expandedReplyThreadIds.has(comment.id);
              return (
                <div className="review-replies-wrap">
                  <button
                    type="button"
                    className="review-replies-toggle"
                    onClick={event => { event.stopPropagation(); toggleReplyThread(comment.id); }}
                    aria-expanded={repliesExpanded}
                  >
                    {repliesExpanded ? `Hide replies (${replies.length})` : `Show replies (${replies.length})`}
                  </button>
                  {repliesExpanded && (
                <div className="review-replies" aria-label="Replies">
                  {replies.map(reply => {
                    const replyEditing = editingId === reply.id;
                    return (
                      <article key={reply.id || `${reply.userId}-${reply.createdAt}`} className="review-card review-reply-card">
                        <div className="review-head">
                          <div className="review-author">
                            <PublicProfileLink comment={reply} className="review-avatar-link">
                              <ReviewAvatar comment={reply} />
                            </PublicProfileLink>
                            <strong className="review-meta">
                              <PublicProfileLink comment={reply} className="review-name review-name-link">
                                {reply.author || 'CineMate User'}
                              </PublicProfileLink>
                              <span className="review-separator">•</span>
                              <span className="review-date">{formatReviewDate(reply.createdAt)}</span>
                            </strong>
                          </div>
                        </div>
                        {replyEditing ? (
                          <div className="review-edit-box">
                            <textarea value={draft} onChange={event => setDraft(event.target.value)} aria-label="Edit reply" />
                            <div className="review-actions">
                              <button type="button" disabled={saving || !draft.trim()} onClick={() => handleSave(reply)}>Save</button>
                              <button type="button" disabled={saving} onClick={() => { setEditingId(null); setDraft(''); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <ReviewText text={reply.text} />
                            <div className="review-inline-actions">
                              <CommentReactionButtons comment={reply} saving={saving} onReact={handleReact} />
                              <button type="button" className="review-reply-btn" disabled={saving} onClick={event => { event.stopPropagation(); startReply(comment.id, reply.author, reply.id); }}>Reply</button>
                            </div>
                            {replyAnchorId === reply.id && (
                              <div className="review-reply-form" onClick={event => event.stopPropagation()}>
                                <textarea value={replyDraft} onChange={event => setReplyDraft(event.target.value)} placeholder={`Reply to ${replyToName}...`} aria-label={`Reply to ${replyToName}`} />
                                <div className="review-reply-actions">
                                  <button type="button" disabled={saving} onClick={() => { setReplyParentId(null); setReplyAnchorId(null); setReplyDraft(''); setReplyToName(''); }}>Cancel</button>
                                  <button type="button" className="primary" disabled={saving || !replyDraft.trim()} onClick={submitReply}>{saving ? 'Posting...' : 'Post Reply'}</button>
                                </div>
                              </div>
                            )}
                            {canShowMenu(reply) && (
                              <div className="review-menu-wrap" onClick={event => event.stopPropagation()}>
                                <button type="button" className="review-menu-trigger" aria-label="Reply options" aria-expanded={openMenuId === reply.id} disabled={saving} onClick={() => setOpenMenuId(openMenuId === reply.id ? null : reply.id)}>⋮</button>
                                {openMenuId === reply.id && (
                                  <div className="review-menu" role="menu">
                                    {reply.canEdit && (
                                      <button type="button" role="menuitem" disabled={saving} onClick={() => { setEditingId(reply.id); setDraft(reply.text || ''); setOpenMenuId(null); }}>Edit</button>
                                    )}
                                    {reply.canReport && (
                                      <button type="button" role="menuitem" disabled={saving} onClick={() => { setReportNotice(''); setReportComment(reply); setOpenMenuId(null); }}>Report</button>
                                    )}
                                    {reply.canEdit && (
                                      <button type="button" role="menuitem" className="danger" disabled={saving} onClick={() => { setConfirmComment(reply); setOpenMenuId(null); }}>Delete</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
                  )}
                </div>
              );
            })()}
            </article>
          );
        }) : (
          <p className="meta detail-empty-message">No reviews match this filter yet.</p>
        )}
      </div>

      {filteredComments.length > 3 && (
        <button type="button" className="review-see-more" onClick={() => setShowAll(value => !value)}>
          {showAll ? 'Show Less Reviews' : `See More Reviews (${filteredComments.length - 3})`}
        </button>
      )}

      {reportNotice && !reportComment && (
        <div className={reportNotice.includes('Sent') ? 'cinemate-toast success' : 'cinemate-toast error'} role="status">
          {reportNotice}
        </div>
      )}

      {reactionNotice && (
        <div className="cinemate-toast error" role="status">
          {reactionNotice}
        </div>
      )}

      <LoginPromptModal message={loginMessage} onClose={() => setLoginMessage('')} />

      {reportComment && (
        <CommentModalPortal>
        <div className="cinemate-confirm-backdrop" role="presentation" onClick={() => setReportComment(null)}>
          <div className="cinemate-confirm-modal" role="dialog" aria-modal="true" aria-label="Report comment" onClick={event => event.stopPropagation()}>
            <h4>Report this comment?</h4>
            <p>Tell the admin team why this comment should be reviewed.</p>
            <div className="report-reason-select">
              <button
                type="button"
                className="report-reason-trigger"
                aria-haspopup="listbox"
                aria-expanded={reportDropdownOpen}
                onClick={() => setReportDropdownOpen(value => !value)}
              >
                <span>{reportReason}</span>
                <span className="report-reason-icon" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M5.5 7.5 10 12l4.5-4.5" /></svg></span>
              </button>
              {reportDropdownOpen && (
                <div className="report-reason-menu" role="listbox" aria-label="Report reason">
                  {['Hateful or abusive message', 'Harassment or bullying', 'Spam or misleading content', 'Inappropriate language', 'Other'].map(reason => (
                    <button
                      key={reason}
                      type="button"
                      role="option"
                      aria-selected={reportReason === reason}
                      className={reportReason === reason ? 'active' : ''}
                      onClick={() => {
                        setReportReason(reason);
                        setReportDropdownOpen(false);
                      }}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea
              className="review-report-textarea"
              value={reportDetails}
              onChange={event => setReportDetails(event.target.value)}
              placeholder="Optional details for the admin..."
              aria-label="Report details"
            />
            {reportNotice && <p className={reportNotice.includes('Sent') ? 'review-report-success' : 'review-report-error'}>{reportNotice}</p>}
            <div className="cinemate-confirm-actions">
              <button type="button" disabled={saving} onClick={() => setReportComment(null)}>Cancel</button>
              <button type="button" className="danger" disabled={saving} onClick={confirmReport}>{saving ? 'Sending...' : 'Send Report'}</button>
            </div>
          </div>
        </div>
        </CommentModalPortal>
      )}

      {confirmComment && (
        <CommentModalPortal>
        <div className="cinemate-confirm-backdrop" role="presentation" onClick={() => setConfirmComment(null)}>
          <div className="cinemate-confirm-modal" role="dialog" aria-modal="true" aria-label={confirmComment.isRatingReview ? 'Remove review text' : 'Delete comment'} onClick={event => event.stopPropagation()}>
            <h4>{confirmComment.isRatingReview ? 'Remove review text?' : 'Delete comment?'}</h4>
            <p>{confirmComment.isRatingReview ? 'This removes only your written review. Your star rating will stay saved.' : 'This will remove your comment from this movie.'}</p>
            <div className="cinemate-confirm-actions">
              <button type="button" disabled={saving} onClick={() => setConfirmComment(null)}>Cancel</button>
              <button type="button" className="danger" disabled={saving} onClick={confirmDelete}>{saving ? 'Saving...' : (confirmComment.isRatingReview ? 'Remove Text' : 'Delete')}</button>
            </div>
          </div>
        </div>
        </CommentModalPortal>
      )}
    </>
  );
}
