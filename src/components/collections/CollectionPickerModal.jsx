'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalScrollLock from '@/hooks/useModalScrollLock';
import useMovieCollections from '@/hooks/useMovieCollections';

export default function CollectionPickerModal({ movie, onClose, onChanged }) {
  const {
    collections,
    loading,
    saving,
    error,
    toggleMovie,
    addCollectionWithMovie,
  } = useMovieCollections(movie);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');
  const [mounted, setMounted] = useState(false);

  useModalScrollLock(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleCreate() {
    const result = await addCollectionWithMovie({ title, description, isPublic: true });
    if (result.success) {
      setTitle('');
      setDescription('');
      setNotice('Collection created and title added.');
      onChanged?.();
    } else if (result.error) {
      setNotice(result.error);
    }
  }

  async function handleToggle(collection) {
    const result = await toggleMovie(collection.id, !collection.hasMovie);
    if (result.success) {
      setNotice(collection.hasMovie ? 'Removed from collection.' : 'Added to collection.');
      onChanged?.();
    } else if (result.error) {
      setNotice(result.error);
    }
  }

  const modal = (
    <div className="cinemate-confirm-backdrop collection-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="cinemate-confirm-modal collection-picker-modal" role="dialog" aria-modal="true" aria-label="Add to collection" onClick={event => event.stopPropagation()}>
        <button type="button" className="collection-modal-close" aria-label="Close collection modal" onClick={onClose}>×</button>
        <div className="collection-modal-header">
          <p className="eyebrow">Custom Collections</p>
          <h4>Add to collection</h4>
          <p>Save <strong>{movie?.title || 'this title'}</strong> into one or more custom playlists.</p>
        </div>

        <div className="collection-create-card">
          <label>
            Collection name
            <input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Comfort Movies" maxLength={80} />
          </label>
          <label>
            Description optional
            <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Short note about this collection..." maxLength={240} />
          </label>
          <button type="button" className="collection-primary-button" disabled={saving || !title.trim()} onClick={handleCreate}>Create and add</button>
        </div>

        <div className="collection-picker-list" aria-live="polite">
          {loading && <p className="meta">Loading your collections...</p>}
          {!loading && !collections.length && <p className="meta">No collections yet. Create your first collection above.</p>}
          {collections.map(collection => (
            <button
              key={collection.id}
              type="button"
              className={`collection-toggle-row${collection.hasMovie ? ' selected' : ''}`}
              disabled={saving}
              onClick={() => handleToggle(collection)}
            >
              <span>
                <strong>{collection.title}</strong>
                <small>{collection.itemCount} title{collection.itemCount === 1 ? '' : 's'} • {collection.isCollaborator ? 'Collaborator' : (collection.isPublic ? 'Shareable' : 'Private')}</small>
              </span>
              <em>{collection.hasMovie ? 'Added' : 'Add'}</em>
            </button>
          ))}
        </div>

        {(error || notice) && <p className="collection-modal-message">{notice || error}</p>}

        <div className="cinemate-confirm-actions">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
