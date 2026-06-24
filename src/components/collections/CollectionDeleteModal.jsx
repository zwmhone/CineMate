'use client';

import { createPortal } from 'react-dom';
import useModalScrollLock from '@/hooks/useModalScrollLock';

export default function CollectionDeleteModal({ collection, saving = false, onCancel, onConfirm }) {
  useModalScrollLock(Boolean(collection));

  if (!collection) return null;

  return createPortal(
    <div className="cinemate-confirm-backdrop collection-delete-backdrop" role="presentation" onClick={onCancel}>
      <section className="cinemate-confirm-modal collection-delete-modal" role="dialog" aria-modal="true" aria-label="Delete collection" onClick={event => event.stopPropagation()}>
        <p className="eyebrow">Delete collection</p>
        <h4>Delete “{collection.title}”?</h4>
        <p>This removes the collection playlist, not the movies or TV shows saved in CineMate.</p>
        <div className="cinemate-confirm-actions">
          <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="button" className="danger" onClick={onConfirm} disabled={saving}>{saving ? 'Deleting...' : 'Delete Collection'}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
