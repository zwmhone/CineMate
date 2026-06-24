'use client';

import { useState } from 'react';
import { createCollectionInviteLink } from '@/lib/collectionCollaborators';

export default function CollectionInviteLinkButton({ collectionId, ownerId, label = 'Copy Invite Link', className = 'collection-secondary-button' }) {
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCopyInvite() {
    if (!collectionId || !ownerId) {
      setStatus('Login needed');
      setTimeout(() => setStatus(''), 1800);
      return;
    }

    setSaving(true);
    setStatus('');
    try {
      const token = await createCollectionInviteLink(collectionId, ownerId);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const inviteLink = `${origin}/collections/${collectionId}?invite=${encodeURIComponent(token)}`;
      await navigator.clipboard.writeText(inviteLink);
      setStatus('Invite copied');
    } catch (error) {
      setStatus(error.message || 'Could not copy invite');
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(''), 2200);
    }
  }

  return (
    <span className="collection-share-wrap collection-invite-link-wrap">
      <button type="button" className={className} disabled={saving} onClick={handleCopyInvite}>
        {saving ? 'Creating...' : label}
      </button>
      {status && <span className="collection-share-feedback">{status}</span>}
    </span>
  );
}
