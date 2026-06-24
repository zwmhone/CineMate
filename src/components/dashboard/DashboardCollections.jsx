'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/AuthContext';
import useCollections from '@/hooks/useCollections';
import { removeMovieFromCollection } from '@/lib/collections';
import { acceptPendingCollectionCollaboration, declinePendingCollectionCollaboration } from '@/lib/collectionCollaborators';
import CollectionShareButton from '@/components/collections/CollectionShareButton';
import CollectionDeleteModal from '@/components/collections/CollectionDeleteModal';
import CollectionCollaboratorsModal from '@/components/collections/CollectionCollaboratorsModal';
import CollectionInviteDecisionModal from '@/components/collections/CollectionInviteDecisionModal';
import CollectionInviteLinkButton from '@/components/collections/CollectionInviteLinkButton';
import { detailUrl } from '@/lib/uiData';

function CollectionCover({ collection }) {
  const coverPoster = collection?.coverPoster || collection?.coverMovie?.poster || collection?.coverMovie?.posterUrl || '';
  const coverTitle = collection?.coverMovie?.title || collection?.title || 'Collection';
  const style = coverPoster
    ? { backgroundImage: `linear-gradient(180deg,rgba(10,3,18,.06),rgba(10,3,18,.74)), url(${coverPoster})` }
    : undefined;

  return (
    <div className={`dashboard-collection-cover${coverPoster ? ' has-cover' : ''}`} style={style} aria-label={`${coverTitle} cover`}>
      {!coverPoster && <span>{String(collection?.title || 'C').charAt(0).toUpperCase()}</span>}
      {coverPoster && <em>Newest added</em>}
    </div>
  );
}


function CompactCollectionItem({ item, onRemoveItem, removingItem }) {
  const movie = item?.movie || {};
  const poster = movie.poster || movie.posterUrl || '';
  const tags = Array.isArray(movie.tags) && movie.tags.length ? movie.tags.slice(0, 3).join(' • ') : (movie.genre || 'Movie');

  return (
    <article className="dashboard-collection-compact-item">
      <div
        className={`dashboard-collection-compact-poster${poster ? ' has-poster' : ''}`}
        style={poster ? { backgroundImage: `url(${poster})` } : undefined}
        aria-hidden="true"
      >
        {!poster && <span>{String(movie.title || 'C').charAt(0).toUpperCase()}</span>}
      </div>
      <div className="dashboard-collection-compact-copy">
        <h4>{movie.title}</h4>
        <p>{tags}</p>
        <small>{movie.runtime || 'Runtime TBA'}{movie.rating ? ` • ★ ${movie.rating}` : ''}</small>
      </div>
      <div className="dashboard-collection-compact-actions" data-no-card-nav>
        <Link href={detailUrl(movie)}>View details</Link>
        <button type="button" className="danger" disabled={removingItem} onClick={() => onRemoveItem?.(item)}>
          Remove
        </button>
      </div>
    </article>
  );
}

function CollectionPreview({ collection, onClose, onRemoveItem, removingItem }) {
  const items = collection?.items || [];

  return (
    <section className="dashboard-collection-preview glass-panel reveal" aria-label={`${collection.title} collection titles`}>
      <div className="dashboard-collection-preview-head">
        <div>
          <p className="eyebrow">Opened collection</p>
          <h3>{collection.title}</h3>
          <p className="meta">{collection.description || 'No description added yet.'}</p>
        </div>
        <button type="button" className="collection-secondary-button" onClick={onClose}>Close</button>
      </div>

      {!items.length ? (
        <div className="collection-empty-card dashboard-collection-inline-empty">
          <h4>No titles yet</h4>
          <p>Open a movie or TV detail page and use the collection icon to add titles here.</p>
        </div>
      ) : (
        <div className="dashboard-collection-compact-list">
          {items.map(item => (
            <CompactCollectionItem
              key={item.id}
              item={item}
              removingItem={removingItem}
              onRemoveItem={onRemoveItem}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DashboardCollections() {
  const { user } = useAuth();
  const {
    collections,
    loading,
    saving,
    error,
    refreshCollections,
    addCollection,
    editCollection,
    removeCollection,
  } = useCollections();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [collaboratorTarget, setCollaboratorTarget] = useState(null);
  const [privateCollaboratorTarget, setPrivateCollaboratorTarget] = useState(null);
  const [inviteDecisionTarget, setInviteDecisionTarget] = useState(null);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [openCollectionId, setOpenCollectionId] = useState('');
  const [removingItem, setRemovingItem] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasCollections = useMemo(() => collections.length > 0, [collections.length]);
  const openCollection = useMemo(
    () => collections.find(collection => collection.id === openCollectionId) || null,
    [collections, openCollectionId]
  );

  useEffect(() => {
    if (openCollectionId && !openCollection) {
      setOpenCollectionId('');
    }
  }, [openCollection, openCollectionId]);

  async function handleCreate() {
    const result = await addCollection({ title, description, isPublic: true });
    if (result.success) {
      setTitle('');
      setDescription('');
      setOpenCollectionId(result.collection.id);
      setNotice('Collection created. Add titles from a movie or TV detail page.');
    } else if (result.error) {
      setNotice(result.error);
    }
  }

  async function handleTogglePrivacy(collection) {
    const result = await editCollection(collection.id, { isPublic: !collection.isPublic });
    if (result.success) {
      setNotice(result.collection.isPublic ? 'Collection is shareable.' : 'Collection is private.');
    } else if (result.error) {
      setNotice(result.error);
    }
  }

  async function handleRemoveItem(item) {
    if (!openCollection || !user?.id) return;
    setRemovingItem(true);
    setNotice('');
    try {
      await removeMovieFromCollection(openCollection.id, item.movieId, user.id);
      await refreshCollections();
      setNotice('Removed from collection.');
    } catch (nextError) {
      setNotice(nextError.message || 'Could not remove this title.');
    } finally {
      setRemovingItem(false);
    }
  }


  async function handleAcceptPendingInvite(collection) {
    if (!collection || !user?.id) return;
    setInviteSaving(true);
    setInviteError('');
    try {
      await acceptPendingCollectionCollaboration(collection.id, user.id);
      await refreshCollections();
      setInviteDecisionTarget(null);
      setNotice('Collaboration invite accepted. You can now manage this collection.');
      setOpenCollectionId(collection.id);
    } catch (nextError) {
      setInviteError(nextError.message || 'Could not accept this invite.');
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleDeclinePendingInvite(collection) {
    if (!collection || !user?.id) return;
    setInviteSaving(true);
    setInviteError('');
    try {
      await declinePendingCollectionCollaboration(collection.id, user.id);
      await refreshCollections();
      if (openCollectionId === collection.id) setOpenCollectionId('');
      setInviteDecisionTarget(null);
      setNotice('Collaboration invite declined.');
    } catch (nextError) {
      setInviteError(nextError.message || 'Could not decline this invite.');
    } finally {
      setInviteSaving(false);
    }
  }

  async function makePrivateCollectionPublic(collection) {
    if (!collection) return;
    const result = await editCollection(collection.id, { isPublic: true });
    if (result.success) {
      setNotice('Collection is public. You can now invite collaborators.');
      setPrivateCollaboratorTarget(null);
      setCollaboratorTarget(result.collection);
    } else if (result.error) {
      setNotice(result.error);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await removeCollection(deleteTarget.id);
    if (result.success) {
      if (openCollectionId === deleteTarget.id) setOpenCollectionId('');
      setNotice('Collection deleted.');
      setDeleteTarget(null);
    } else if (result.error) {
      setNotice(result.error);
    }
  }

  return (
    <section className="glass-panel dashboard-collections-panel reveal">
      <div className="dashboard-collections-head">
        <div>
          <p className="eyebrow">Custom playlists</p>
          <h3>Custom Collections</h3>
          <p className="meta">Create shareable movie and TV playlists, then add titles from the movie or TV detail page collection icon.</p>
        </div>
      </div>

      <div className="dashboard-collections-create">
        <label>
          Collection name
          <input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Comfort Movies" maxLength={80} />
        </label>
        <label>
          Description optional
          <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Short note about this collection..." maxLength={240} />
        </label>
        <button type="button" className="collection-primary-button" disabled={saving || !title.trim()} onClick={handleCreate}>Create Collection</button>
      </div>

      {(error || notice) && <p className="collection-status dashboard-collection-status">{notice || error}</p>}
      {loading && <p className="meta">Loading collections...</p>}
      {!loading && !hasCollections && <p className="meta">No collections yet. Create one here, then add titles from a movie page.</p>}

      <div className="dashboard-collections-grid">
        {collections.map(collection => (
          <article key={collection.id} className={`dashboard-collection-card${openCollectionId === collection.id ? ' is-open' : ''}`}>
            <CollectionCover collection={collection} />
            <div className="dashboard-collection-card-body">
              <span className="collection-visibility">{collection.isPendingInvite ? 'Invite pending' : (collection.isCollaborator ? 'Collaborator' : (collection.isPublic ? 'Shareable' : 'Private'))}</span>
              <h4>{collection.title}</h4>
              <p>{collection.description || 'No description added yet.'}</p>
              <strong>{collection.itemCount} title{collection.itemCount === 1 ? '' : 's'}</strong>
            </div>
            <div className="dashboard-collection-actions">
              {collection.isPendingInvite ? (
                <>
                  <button type="button" className="collection-open-button" onClick={() => setInviteDecisionTarget(collection)}>
                    Review Invite
                  </button>
                  <button type="button" className="danger" onClick={() => handleDeclinePendingInvite(collection)} disabled={inviteSaving}>
                    Decline
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="collection-open-button" onClick={() => setOpenCollectionId(current => current === collection.id ? '' : collection.id)}>
                    {openCollectionId === collection.id ? 'Close' : 'Open'}
                  </button>
                  {collection.isPublic && <CollectionShareButton collectionId={collection.id} label="Share" />}
                  {collection.isOwner && collection.isPublic && <CollectionInviteLinkButton collectionId={collection.id} ownerId={user?.id || ''} label="Invite Link" />}
                  {!collection.isOwner && collection.isPublic && <CollectionShareButton collectionId={collection.id} label="Copy Link" />}
                  {collection.isOwner && (
                    <>
                      <button type="button" onClick={() => collection.isPublic ? setCollaboratorTarget(collection) : setPrivateCollaboratorTarget(collection)}>Collaborators</button>
                      <button type="button" onClick={() => handleTogglePrivacy(collection)}>{collection.isPublic ? 'Make Private' : 'Make Public'}</button>
                      <button type="button" className="danger" onClick={() => setDeleteTarget(collection)}>Delete</button>
                    </>
                  )}
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      {openCollection && (
        <CollectionPreview
          collection={openCollection}
          removingItem={removingItem}
          onRemoveItem={handleRemoveItem}
          onClose={() => setOpenCollectionId('')}
        />
      )}

      {mounted && inviteDecisionTarget && (
        <CollectionInviteDecisionModal
          collection={inviteDecisionTarget}
          mode="direct"
          saving={inviteSaving}
          error={inviteError}
          onAccept={() => handleAcceptPendingInvite(inviteDecisionTarget)}
          onDecline={() => handleDeclinePendingInvite(inviteDecisionTarget)}
          onClose={() => { setInviteDecisionTarget(null); setInviteError(''); }}
        />
      )}

      {mounted && privateCollaboratorTarget && typeof document !== 'undefined' && createPortal((
        <div className="cinemate-confirm-backdrop collection-modal-backdrop global-modal-backdrop" role="presentation" onClick={() => setPrivateCollaboratorTarget(null)}>
          <section className="cinemate-confirm-modal collection-private-collab-modal global-modal-panel" role="dialog" aria-modal="true" aria-label="Make collection public" onClick={event => event.stopPropagation()}>
            <p className="eyebrow">Private collection</p>
            <h4>Make this collection public first</h4>
            <p>Collaborators need a public/shareable collection link before they can join. Make <strong>{privateCollaboratorTarget.title}</strong> public to invite collaborators.</p>
            <div className="cinemate-confirm-actions">
              <button type="button" onClick={() => setPrivateCollaboratorTarget(null)}>Cancel</button>
              <button type="button" className="primary-action" disabled={saving} onClick={() => makePrivateCollectionPublic(privateCollaboratorTarget)}>{saving ? 'Saving...' : 'Make Public'}</button>
            </div>
          </section>
        </div>
      ), document.body)}

      {mounted && collaboratorTarget && (
        <CollectionCollaboratorsModal
          collection={collaboratorTarget}
          ownerId={user?.id || ''}
          onClose={() => setCollaboratorTarget(null)}
          onChanged={refreshCollections}
        />
      )}

      {mounted && (
        <CollectionDeleteModal
          collection={deleteTarget}
          saving={saving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  );
}
