'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalScrollLock from '@/hooks/useModalScrollLock';
import CollectionInviteLinkButton from '@/components/collections/CollectionInviteLinkButton';
import {
  addCollectionCollaborator,
  listCollaborationCandidates,
  listCollectionCollaborators,
  removeCollectionCollaborator,
} from '@/lib/collectionCollaborators';

function profileInitial(name = '') {
  return String(name || 'CineMate User').trim().charAt(0).toUpperCase() || 'C';
}

function CollaboratorAvatar({ user }) {
  if (user?.profileImage) {
    return <img src={user.profileImage} alt={`${user.name} profile`} loading="lazy" />;
  }
  return <span>{profileInitial(user?.name)}</span>;
}

function UserRow({ user, actionLabel, actionClass = '', disabled = false, meta = '', onAction }) {
  return (
    <article className="collection-collab-user-row">
      <div className="collection-collab-user-main">
        <span className="collection-collab-avatar"><CollaboratorAvatar user={user} /></span>
        <span>
          <strong>{user?.name || 'CineMate User'}</strong>
          <small>{meta}</small>
        </span>
      </div>
      <button type="button" className={actionClass} disabled={disabled} onClick={onAction}>
        {actionLabel}
      </button>
    </article>
  );
}

export default function CollectionCollaboratorsModal({ collection, ownerId, onClose, onChanged }) {
  const [mounted, setMounted] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState('');
  const [notice, setNotice] = useState('');

  useModalScrollLock(true);

  const collectionId = collection?.id || collection?.collectionId || '';
  const title = collection?.title || 'collection';
  const isPublic = Boolean(collection?.isPublic);
  const collaboratorIds = useMemo(() => new Set(collaborators.map(item => item.userId)), [collaborators]);
  const inviteCandidates = useMemo(
    () => candidates.filter(user => !collaboratorIds.has(user.id)),
    [candidates, collaboratorIds]
  );

  async function refresh() {
    if (!collectionId || !ownerId) return;
    setLoading(true);
    setNotice('');
    try {
      const [nextCollaborators, nextCandidates] = await Promise.all([
        listCollectionCollaborators(collectionId),
        listCollaborationCandidates(collectionId, ownerId),
      ]);
      setCollaborators(nextCollaborators);
      setCandidates(nextCandidates);
    } catch (error) {
      setNotice(error.message || 'Could not load collaborators.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, ownerId]);

  async function handleInvite(userId) {
    setSavingUserId(userId);
    setNotice('');
    try {
      await addCollectionCollaborator(collectionId, userId, ownerId);
      await refresh();
      onChanged?.();
      setNotice('Invite sent. They will become a collaborator only after accepting.');
    } catch (error) {
      setNotice(error.message || 'Could not add collaborator.');
    } finally {
      setSavingUserId('');
    }
  }

  async function handleRemove(userId) {
    setSavingUserId(userId);
    setNotice('');
    try {
      await removeCollectionCollaborator(collectionId, userId, ownerId);
      await refresh();
      onChanged?.();
      setNotice('Collaborator removed.');
    } catch (error) {
      setNotice(error.message || 'Could not remove collaborator.');
    } finally {
      setSavingUserId('');
    }
  }

  const modal = (
    <div className="cinemate-confirm-backdrop collection-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="cinemate-confirm-modal collection-collaborators-modal" role="dialog" aria-modal="true" aria-label="Manage collection collaborators" onClick={event => event.stopPropagation()}>
        <button type="button" className="collection-modal-close" aria-label="Close collaborators modal" onClick={onClose}>×</button>
        <div className="collection-modal-header">
          <p className="eyebrow">Collection Collaboration</p>
          <h4>Manage collaborators</h4>
          {isPublic ? (
            <>
              <p>Invite followers or people you follow to help manage <strong>{title}</strong>.</p>
              <p className="collection-collab-note">Collaborators can add and remove titles. Only you can delete the collection, change privacy, or manage collaborators.</p>
              <div className="collection-collab-link-row">
                <span>Send an invite link so someone can join as a collaborator.</span>
                <CollectionInviteLinkButton collectionId={collectionId} ownerId={ownerId} label="Copy Invite Link" />
              </div>
            </>
          ) : (
            <p className="collection-collab-note">This collection is private. Make it public before inviting collaborators.</p>
          )}
        </div>

        {notice && <p className="collection-modal-message">{notice}</p>}
        {loading && isPublic && <p className="meta">Loading collaborators...</p>}

        {isPublic && <div className="collection-collab-section">
          <div className="collection-collab-section-head">
            <h5>Current collaborators</h5>
            <span>{collaborators.length}</span>
          </div>
          {!loading && !collaborators.length && <p className="meta">No collaborators yet.</p>}
          {collaborators.map(item => (
            <UserRow
              key={item.userId}
              user={item.user}
              meta={item.isPending ? 'Invitation pending' : 'Can add and remove titles'}
              actionLabel={item.isPending ? 'Cancel Invite' : 'Remove'}
              actionClass="danger"
              disabled={savingUserId === item.userId}
              onAction={() => handleRemove(item.userId)}
            />
          ))}
        </div>}

        {isPublic && <div className="collection-collab-section">
          <div className="collection-collab-section-head">
            <h5>Invite from followers/following</h5>
            <span>{inviteCandidates.length}</span>
          </div>
          {!loading && !inviteCandidates.length && <p className="meta">No new followers or following users to invite yet.</p>}
          {inviteCandidates.map(user => (
            <UserRow
              key={user.id}
              user={user}
              meta={user.relationshipLabel || 'CineMate user'}
              actionLabel="Invite"
              actionClass="collection-primary-small"
              disabled={savingUserId === user.id}
              onAction={() => handleInvite(user.id)}
            />
          ))}
        </div>}

        <div className="cinemate-confirm-actions">
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
