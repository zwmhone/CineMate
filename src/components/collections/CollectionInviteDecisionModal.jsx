'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalScrollLock from '@/hooks/useModalScrollLock';

export default function CollectionInviteDecisionModal({
  collection,
  mode = 'direct',
  saving = false,
  error = '',
  onAccept,
  onDecline,
  onClose,
}) {
  const [mounted, setMounted] = useState(false);
  useModalScrollLock(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const title = collection?.title || 'this collection';
  const ownerName = collection?.owner?.name || 'the collection creator';
  const itemCount = Number(collection?.itemCount || collection?.items?.length || 0);
  const description = collection?.description || '';
  const ownerImage = collection?.owner?.profileImage || '';
  const ownerInitial = ownerName.charAt(0).toUpperCase();

  const modal = (
    <div className="cinemate-confirm-backdrop collection-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="cinemate-confirm-modal collection-invite-decision-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Collection collaboration invite"
        onClick={event => event.stopPropagation()}
      >
        <button type="button" className="collection-modal-close" aria-label="Close invite modal" onClick={onClose}>×</button>
        <p className="eyebrow">Collection invite</p>
        <h4>Join as collaborator?</h4>
        <p>
          {mode === 'link'
            ? 'This invite link lets you help manage the collection.'
            : `${ownerName} invited you to help manage this collection.`}
        </p>
        <div className="collection-invite-summary">
          <div className="collection-invite-owner-row">
            <span className="collection-invite-owner-avatar">
              {ownerImage ? <img src={ownerImage} alt="" /> : ownerInitial}
            </span>
            <span>Created by {ownerName}</span>
          </div>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
          <span>{itemCount} title{itemCount === 1 ? '' : 's'} • Collaborators can add and remove titles</span>
        </div>
        {error && <p className="collection-modal-message error">{error}</p>}
        <div className="cinemate-confirm-actions collection-invite-actions">
          <button type="button" onClick={onDecline || onClose} disabled={saving}>No, thanks</button>
          <button type="button" className="collection-primary-small" onClick={onAccept} disabled={saving}>
            {saving ? 'Accepting...' : 'Accept Invite'}
          </button>
        </div>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
