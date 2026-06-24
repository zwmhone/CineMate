'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getCollection, removeMovieFromCollection } from '@/lib/collections';
import { acceptCollectionInvite, acceptPendingCollectionCollaboration, declinePendingCollectionCollaboration, getCollectionInvitePreview, removeCollectionCollaborator } from '@/lib/collectionCollaborators';
import LoginPromptModal from '@/components/common/LoginPromptModal';
import CollectionMovieCard from './CollectionMovieCard';
import CollectionShareButton from './CollectionShareButton';
import CollectionComments from './CollectionComments';
import CollectionInviteDecisionModal from './CollectionInviteDecisionModal';

export default function CollectionDetailPage({ collectionId, inviteToken = '' }) {
  const { user, ready } = useAuth();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [inviteHandled, setInviteHandled] = useState(false);
  const [showInviteDecision, setShowInviteDecision] = useState(false);
  const [invitePreview, setInvitePreview] = useState(null);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  const loadCollection = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const row = await getCollection(collectionId, user?.id || null);
      setCollection(row);
    } catch (nextError) {
      setError(nextError.message || 'Could not load this collection.');
      setCollection(null);
    } finally {
      setLoading(false);
    }
  }, [collectionId, user?.id]);

  useEffect(() => {
    if (!ready) return;

    async function loadOrPromptInvite() {
      if (!inviteToken || inviteHandled) {
        await loadCollection();
        return;
      }

      try {
        const preview = await getCollectionInvitePreview(collectionId, inviteToken);
        setInvitePreview(preview);
      } catch (previewError) {
        setInvitePreview({ id: collectionId, title: 'this collection', itemCount: 0 });
        setInviteError(previewError.message || 'Could not load invite details.');
      }

      if (!user?.id) {
        setLoginMessage('Please log in to accept this collection collaboration invite.');
        setInviteHandled(true);
        await loadCollection();
        return;
      }

      setLoading(false);
      setError('');
      setNotice('');
      setShowInviteDecision(true);
    }

    loadOrPromptInvite();
  }, [ready, loadCollection, inviteToken, inviteHandled, user?.id]);

  async function handleAcceptLinkInvite() {
    if (!user?.id) {
      setLoginMessage('Please log in to accept this collection collaboration invite.');
      return;
    }
    setInviteSaving(true);
    setInviteError('');
    try {
      const result = await acceptCollectionInvite(collectionId, inviteToken, user.id);
      setInviteHandled(true);
      setShowInviteDecision(false);
      setNotice(result === 'owner' ? 'You already own this collection.' : result === 'already_collaborator' ? 'You are already a collaborator.' : 'Invite accepted. You can now manage this collection.');
      const row = await getCollection(collectionId, user.id);
      setCollection(row);
      setError('');
    } catch (nextError) {
      setInviteError(nextError.message || 'Could not accept this invite.');
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleAcceptPendingInvite() {
    if (!user?.id || !collection?.isPendingInvite) return;
    setInviteSaving(true);
    setInviteError('');
    try {
      await acceptPendingCollectionCollaboration(collection.id, user.id);
      setShowInviteDecision(false);
      setNotice('Invite accepted. You can now manage this collection.');
      await loadCollection();
    } catch (nextError) {
      setInviteError(nextError.message || 'Could not accept this invite.');
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleDeclinePendingInvite() {
    if (!user?.id || !collection?.isPendingInvite) {
      setShowInviteDecision(false);
      setInviteHandled(true);
      await loadCollection();
      return;
    }
    setInviteSaving(true);
    setInviteError('');
    try {
      await declinePendingCollectionCollaboration(collection.id, user.id);
      setShowInviteDecision(false);
      setInviteHandled(true);
      setNotice('Collaboration invite declined.');
      await loadCollection();
    } catch (nextError) {
      setInviteError(nextError.message || 'Could not decline this invite.');
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleRemove(item) {
    if (!collection?.canManageItems || !user?.id) return;
    setRemoving(true);
    setNotice('');
    try {
      await removeMovieFromCollection(collection.id, item.movieId, user.id);
      setNotice('Removed from collection.');
      await loadCollection();
    } catch (nextError) {
      setNotice(nextError.message || 'Could not remove this title.');
    } finally {
      setRemoving(false);
    }
  }

  async function handleLeaveCollection() {
    if (!collection?.isCollaborator || collection?.isOwner || !user?.id) return;
    setActionMenuOpen(false);
    setRemoving(true);
    setNotice('');
    try {
      await removeCollectionCollaborator(collection.id, user.id, user.id);
      setNotice('You left this collaborative collection.');
      setCollection(previous => previous ? {
        ...previous,
        isCollaborator: false,
        canManageItems: false,
        collaborationStatus: '',
      } : previous);
    } catch (nextError) {
      setNotice(nextError.message || 'Could not leave this collection.');
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <main className="collections-page page-section">
        <section className="glass-panel collection-empty-card reveal">
          <p className="eyebrow">Collection</p>
          <h1 className="gradient-text">Loading</h1>
          <p>Loading this collection...</p>
        </section>
        <LoginPromptModal message={loginMessage} onClose={() => setLoginMessage('')} />
      </main>
    );
  }

  if (error || !collection) {
    return (
      <main className="collections-page page-section">
        <section className="glass-panel collection-empty-card reveal">
          <p className="eyebrow">Collection unavailable</p>
          <h1 className="gradient-text">Could not open collection</h1>
          <p>{error || 'This collection may be private or deleted.'}</p>
          <Link className="collection-primary-link" href="/dashboard?tab=collections">Back to dashboard</Link>
        </section>
        {showInviteDecision && (
          <CollectionInviteDecisionModal
            collection={invitePreview || { id: collectionId, title: 'this collection', itemCount: 0 }}
            mode="link"
            saving={inviteSaving}
            error={inviteError}
            onAccept={handleAcceptLinkInvite}
            onDecline={handleDeclinePendingInvite}
            onClose={() => { setShowInviteDecision(false); setInviteError(''); if (inviteToken && !inviteHandled) setInviteHandled(true); }}
          />
        )}
        <LoginPromptModal message={loginMessage} onClose={() => setLoginMessage('')} />
      </main>
    );
  }

  return (
    <main className="collections-page page-section">
      <section className="collections-detail-hero glass-panel reveal">
        <div>
          <p className="eyebrow">{collection.isCollaborator ? 'Collaborative collection' : (collection.isPublic ? 'Shareable collection' : 'Private collection')}</p>
          <h1 className="gradient-text">{collection.title}</h1>
          <p>{collection.description || 'A custom CineMate collection.'}</p>
          <p className="meta">Created by {collection.owner?.name || 'CineMate user'} • {collection.items.length} title{collection.items.length === 1 ? '' : 's'}</p>
        </div>
        <div className="collection-detail-actions">
          {collection.isPublic && <CollectionShareButton collectionId={collection.id} label="Copy Share Link" />}
          {collection.isPendingInvite && <button type="button" onClick={() => setShowInviteDecision(true)}>Review Invite</button>}
          {(collection.isOwner || collection.isCollaborator) && <Link href="/dashboard?tab=collections">Manage Collections</Link>}
          {collection.isCollaborator && !collection.isOwner && (
            <div className="collection-more-menu-wrap">
              <button
                type="button"
                className="collection-more-trigger"
                onClick={() => setActionMenuOpen(previous => !previous)}
                aria-label="Collection actions"
                aria-haspopup="menu"
                aria-expanded={actionMenuOpen}
              >
                <span aria-hidden="true">•••</span>
              </button>
              {actionMenuOpen && (
                <div className="collection-more-menu" role="menu">
                  <button
                    type="button"
                    className="collection-menu-danger"
                    onClick={handleLeaveCollection}
                    disabled={removing}
                    role="menuitem"
                  >
                    {removing ? 'Leaving...' : 'Leave Collection'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {collection.isPendingInvite && (
        <p className="collection-status glass-panel">You have been invited to collaborate on this collection. Accept the invite before adding or removing titles.</p>
      )}
      {notice && <p className="collection-status glass-panel">{notice}</p>}

      <section className="collections-list-section reveal">
        <p className="eyebrow">Collection titles</p>
        {!collection.items.length ? (
          <div className="glass-panel collection-empty-card">
            <h2>No titles yet</h2>
            <p>{collection.canManageItems ? 'Open any movie detail page and use the collection icon to add titles here.' : 'This shared collection does not contain any titles yet.'}</p>
          </div>
        ) : (
          <div className="collection-movie-grid">
            {collection.items.map(item => (
              <CollectionMovieCard
                key={item.id}
                item={item}
                canRemove={collection.canManageItems}
                removing={removing}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </section>

      <CollectionComments
        collectionId={collection.id}
        collectionTitle={collection.title}
        isOwner={collection.isOwner}
      />
      {showInviteDecision && (
        <CollectionInviteDecisionModal
          collection={collection || invitePreview || { id: collectionId, title: 'this collection', itemCount: 0 }}
          mode={inviteToken && !collection?.isPendingInvite ? 'link' : 'direct'}
          saving={inviteSaving}
          error={inviteError}
          onAccept={inviteToken && !collection?.isPendingInvite ? handleAcceptLinkInvite : handleAcceptPendingInvite}
          onDecline={handleDeclinePendingInvite}
          onClose={() => { setShowInviteDecision(false); setInviteError(''); if (inviteToken && !inviteHandled) setInviteHandled(true); }}
        />
      )}
      <LoginPromptModal message={loginMessage} onClose={() => setLoginMessage('')} />
    </main>
  );
}
