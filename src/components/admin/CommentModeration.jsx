'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalScrollLock from '@/hooks/useModalScrollLock';

function AdminModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  } catch {
    return '—';
  }
}

function sourceLabel(comment) {
  return comment.source_type === 'collection' ? 'Collection comment' : 'Movie comment';
}

function contentTitle(comment) {
  if (comment.source_type === 'collection') return comment.collection_title || 'Collection';
  return comment.movie_title || `Movie ID ${comment.movie_id}`;
}

function authorId(comment) {
  return comment.author_user_id || comment.user_id || '';
}

export default function CommentModeration({
  comments = [],
  saving = false,
  initialFilter = 'reported',
  onHide,
  onUnhide,
  onDismiss,
  onDelete,
  onIssueWarning,
}) {
  const [filter, setFilter] = useState(initialFilter);
  const [hideTarget, setHideTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [hideReason, setHideReason] = useState('Removed because it breaks CineMate community rules.');
  const [warnTarget, setWarnTarget] = useState(null);
  const [warnReporterTarget, setWarnReporterTarget] = useState(null);
  const [warningReason, setWarningReason] = useState('This comment breaks CineMate community rules. Please avoid hate, spam, harassment, or abusive content.');
  const [reporterWarningReason, setReporterWarningReason] = useState('Please use the report feature only for genuine hate, spam, harassment, or abusive content. Repeated false or abusive reports can lead to account restrictions.');

  useModalScrollLock(Boolean(hideTarget || deleteTarget || warnTarget || warnReporterTarget));

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const filteredComments = useMemo(() => {
    if (filter === 'reported') return comments.filter(comment => Number(comment.report_count || 0) > 0 && !comment.is_hidden);
    if (filter === 'hidden') return comments.filter(comment => comment.is_hidden);
    if (filter === 'visible') return comments.filter(comment => !comment.is_hidden);
    return comments.filter(comment => !comment.is_hidden && Number(comment.report_count || 0) === 0);
  }, [comments, filter]);

  async function confirmHide() {
    if (!hideTarget || typeof onHide !== 'function') return;
    await onHide(hideTarget.comment_id, hideReason || 'Removed by admin', hideTarget.source_type || 'movie');
    setHideTarget(null);
    setHideReason('Removed because it breaks CineMate community rules.');
  }

  async function confirmDelete() {
    if (!deleteTarget || typeof onDelete !== 'function') return;
    await onDelete(deleteTarget.comment_id, deleteTarget.source_type || 'movie');
    setDeleteTarget(null);
  }


  async function confirmWarning() {
    const targetUserId = authorId(warnTarget);
    if (!warnTarget || !targetUserId || typeof onIssueWarning !== 'function') return;
    await onIssueWarning({
      userId: targetUserId,
      sourceType: warnTarget.source_type || 'movie',
      sourceId: warnTarget.comment_id,
      reason: warningReason || 'Warning issued by admin',
    });
    setWarnTarget(null);
    setWarningReason('This comment breaks CineMate community rules. Please avoid hate, spam, harassment, or abusive content.');
  }

  async function confirmReporterWarning() {
    if (!warnReporterTarget?.latest_reporter_id || typeof onIssueWarning !== 'function') return;
    await onIssueWarning({
      userId: warnReporterTarget.latest_reporter_id,
      sourceType: `report_${warnReporterTarget.source_type || 'movie'}`,
      sourceId: warnReporterTarget.comment_id,
      reason: reporterWarningReason || 'Warning issued for false or abusive reporting.',
    });
    setWarnReporterTarget(null);
    setReporterWarningReason('Please use the report feature only for genuine hate, spam, harassment, or abusive content. Repeated false or abusive reports can lead to account restrictions.');
  }

  return (
    <section className="cm-admin-panel cm-admin-wide-panel">
      <div className="cm-admin-section-head">
        <div>
          <p className="cm-admin-eyebrow">Comment moderation</p>
          <h3>{filter === 'reported' ? 'Reported Comments' : filter === 'hidden' ? 'Hidden Comments' : filter === 'visible' ? 'Visible Comments' : 'All Comments'}</h3>
          <p className="cm-admin-help-text">
            Review all user comments, reports, hidden comments, warnings, and severe abuse actions.
          </p>
        </div>
        <div className="cm-admin-tabs" role="tablist" aria-label="Moderation filter">
          {['all', 'reported', 'visible', 'hidden'].map(tab => (
            <button key={tab} type="button" className={filter === tab ? 'active' : ''} onClick={() => setFilter(tab)}>
              {tab === 'reported' ? 'Reported' : tab === 'hidden' ? 'Hidden' : tab === 'visible' ? 'Visible' : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="cm-admin-comment-list">
        {filteredComments.map(comment => {
          const targetUserId = authorId(comment);
          const currentStrikes = Number(comment.active_warning_count || comment.warning_count || 0);
          const reporterStrikes = Number(comment.latest_reporter_active_warning_count || comment.reporter_warning_count || 0);
          return (
            <article key={`${comment.source_type || 'movie'}-${comment.comment_id}`} className={`cm-admin-comment-card ${comment.is_hidden ? 'is-hidden' : ''}`}>
              <div className="cm-admin-comment-head">
                <div>
                  <strong>{comment.author_name || comment.author_email || 'Deleted User'}</strong>
                  <span>{sourceLabel(comment)} · {contentTitle(comment)} · {formatDate(comment.created_at)}</span>
                </div>
                <div className="cm-admin-report-count">
                  {Number(comment.report_count || 0)} open report{Number(comment.report_count || 0) === 1 ? '' : 's'}
                </div>
              </div>

              <p className="cm-admin-comment-text">{comment.comment_text}</p>

              <div className="cm-admin-warning-strip">
                <strong>{Math.min(currentStrikes, 3)}/3 strikes</strong>
                <span>{currentStrikes >= 3 ? 'Final warning issued. This account is blocked.' : currentStrikes >= 2 ? 'Next action will block this account.' : `${Math.max(0, 2 - currentStrikes)} strike${2 - currentStrikes === 1 ? '' : 's'} before the final warning.`}</span>
              </div>

              {(comment.latest_report_reason || comment.latest_report_details) && (
                <div className="cm-admin-report-box">
                  <strong>Latest report:</strong>
                  <span>{comment.latest_report_reason || 'Reported comment'}</span>
                  {comment.latest_report_details && <p>{comment.latest_report_details}</p>}
                  {comment.latest_reporter_id && (
                    <p className="cm-admin-report-meta">
                      Reported by <strong>Anonymous reporter</strong>
                      {` • Reporter strikes: ${Math.min(reporterStrikes, 3)}/3${reporterStrikes >= 3 ? ' final warning issued' : ''}`}
                    </p>
                  )}
                </div>
              )}

              {comment.is_hidden && <p className="cm-admin-hidden-note">Hidden: {comment.hidden_reason || 'Removed by admin'}</p>}

              <div className="cm-admin-card-actions">
                {comment.is_hidden ? (
                  <button type="button" className="cm-admin-mini-btn restore-action" disabled={saving} onClick={() => onUnhide?.(comment.comment_id, comment.source_type || 'movie')}>Restore Comment</button>
                ) : (
                  <button type="button" className="cm-admin-mini-btn danger" disabled={saving} onClick={() => setHideTarget(comment)}>Hide Comment</button>
                )}
                {Number(comment.report_count || 0) > 0 && !comment.is_hidden && (
                  <button type="button" className="cm-admin-mini-btn primary-action" disabled={saving} onClick={() => onDismiss?.(comment.comment_id, comment.source_type || 'movie')}>Dismiss Reports</button>
                )}
                {targetUserId && currentStrikes < 3 && (
                  <button type="button" className="cm-admin-mini-btn warning-action" disabled={saving} onClick={() => setWarnTarget(comment)}>
                    {currentStrikes >= 2 ? 'Block User' : 'Warn User'}
                  </button>
                )}
                {comment.latest_reporter_id && reporterStrikes < 3 && (
                  <button type="button" className="cm-admin-mini-btn warning-action subtle" disabled={saving} onClick={() => setWarnReporterTarget(comment)}>
                    {reporterStrikes >= 2 ? 'Block Reporter' : 'Warn Reporter'}
                  </button>
                )}
                <button type="button" className="cm-admin-mini-btn danger subtle" disabled={saving} onClick={() => setDeleteTarget(comment)}>Delete Permanently</button>
              </div>
            </article>
          );
        })}
      </div>

      {!filteredComments.length && <p className="cm-admin-meta cm-admin-empty">No comments in this section yet.</p>}

      {hideTarget && (
        <AdminModalPortal>
          <div className="cinemate-confirm-backdrop cm-admin-modal-backdrop" role="presentation" onClick={() => setHideTarget(null)}>
            <div className="cinemate-confirm-modal cm-admin-confirm-modal" role="dialog" aria-modal="true" aria-label="Hide comment" onClick={event => event.stopPropagation()}>
              <h4>Hide this comment?</h4>
              <p>The comment will no longer show publicly. Reports for this comment will be marked as removed.</p>
              <textarea className="cm-admin-reason-input" value={hideReason} onChange={event => setHideReason(event.target.value)} placeholder="Moderation reason..." aria-label="Moderation reason" />
              <div className="cinemate-confirm-actions">
                <button type="button" disabled={saving} onClick={() => setHideTarget(null)}>Cancel</button>
                <button type="button" className="danger" disabled={saving} onClick={confirmHide}>{saving ? 'Saving...' : 'Hide Comment'}</button>
              </div>
            </div>
          </div>
        </AdminModalPortal>
      )}

      {warnTarget && (
        <AdminModalPortal>
          <div className="cinemate-confirm-backdrop cm-admin-modal-backdrop" role="presentation" onClick={() => setWarnTarget(null)}>
            <div className="cinemate-confirm-modal cm-admin-confirm-modal" role="dialog" aria-modal="true" aria-label="Issue warning" onClick={event => event.stopPropagation()}>
              <h4>Issue warning to {warnTarget.author_name || warnTarget.author_email || 'this user'}?</h4>
              <p>This adds one strike to the user. CineMate gives 3 strikes. If this is the third strike, the user will be blocked automatically.</p>
              <textarea className="cm-admin-reason-input" value={warningReason} onChange={event => setWarningReason(event.target.value)} placeholder="Warning reason..." aria-label="Warning reason" />
              <div className="cinemate-confirm-actions">
                <button type="button" disabled={saving} onClick={() => setWarnTarget(null)}>Cancel</button>
                <button type="button" className="danger" disabled={saving} onClick={confirmWarning}>{saving ? 'Saving...' : Number(warnTarget?.active_warning_count || warnTarget?.warning_count || 0) >= 2 ? 'Block User' : 'Issue Warning'}</button>
              </div>
            </div>
          </div>
        </AdminModalPortal>
      )}

      {warnReporterTarget && (
        <AdminModalPortal>
          <div className="cinemate-confirm-backdrop cm-admin-modal-backdrop" role="presentation" onClick={() => setWarnReporterTarget(null)}>
            <div className="cinemate-confirm-modal cm-admin-confirm-modal" role="dialog" aria-modal="true" aria-label="Warn reporter" onClick={event => event.stopPropagation()}>
              <h4>Warn anonymous reporter?</h4>
              <p>This adds one strike to the reporter for false, spam, or abusive reports. CineMate gives 3 strikes. If this is the third strike, the reporter will be blocked automatically.</p>
              <div className="cm-admin-warning-preview">
                <strong>{Number(warnReporterTarget.latest_reporter_active_warning_count || 0) >= 2 ? 'Reporter will be blocked after this action' : `${Number(warnReporterTarget.latest_reporter_active_warning_count || 0) + 1}/3 strikes after this warning`}</strong>
                <span>{Number(warnReporterTarget.latest_reporter_active_warning_count || 0) >= 2 ? 'This is the third strike. Issuing it will block the reporter account.' : `${Math.max(0, 2 - Number(warnReporterTarget.latest_reporter_active_warning_count || 0))} strike${2 - Number(warnReporterTarget.latest_reporter_active_warning_count || 0) === 1 ? '' : 's'} left before the final strike.`}</span>
              </div>
              <textarea className="cm-admin-reason-input" value={reporterWarningReason} onChange={event => setReporterWarningReason(event.target.value)} placeholder="Reporter warning reason..." aria-label="Reporter warning reason" />
              <div className="cinemate-confirm-actions">
                <button type="button" disabled={saving} onClick={() => setWarnReporterTarget(null)}>Cancel</button>
                <button type="button" className="danger" disabled={saving} onClick={confirmReporterWarning}>{saving ? 'Saving...' : Number(warnReporterTarget?.latest_reporter_active_warning_count || warnReporterTarget?.reporter_warning_count || 0) >= 2 ? 'Block Reporter' : 'Issue Warning'}</button>
              </div>
            </div>
          </div>
        </AdminModalPortal>
      )}

      {deleteTarget && (
        <AdminModalPortal>
          <div className="cinemate-confirm-backdrop cm-admin-modal-backdrop" role="presentation" onClick={() => setDeleteTarget(null)}>
            <div className="cinemate-confirm-modal cm-admin-confirm-modal" role="dialog" aria-modal="true" aria-label="Delete comment" onClick={event => event.stopPropagation()}>
              <h4>Delete this comment permanently?</h4>
              <p>This removes the comment and its reports from CineMate. Use this for severe abuse; hide is safer when you want to keep audit evidence.</p>
              <div className="cinemate-confirm-actions">
                <button type="button" disabled={saving} onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button type="button" className="danger" disabled={saving} onClick={confirmDelete}>{saving ? 'Deleting...' : 'Delete Comment'}</button>
              </div>
            </div>
          </div>
        </AdminModalPortal>
      )}
    </section>
  );
}
