'use client';

import { useEffect, useState } from 'react';

function collectionUrl(collectionId) {
  if (typeof window === 'undefined') return `/collections/${collectionId}`;
  return `${window.location.origin}/collections/${collectionId}`;
}

export default function CollectionShareButton({ collectionId, label = 'Share' }) {
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function handleShare(event) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(collectionUrl(collectionId));
      setNotice('Collection link copied!');
    } catch (_) {
      setNotice('Could not copy link');
    }
  }

  return (
    <span className="collection-share-wrap" data-no-card-nav>
      <button type="button" className="collection-secondary-button" onClick={handleShare}>{label}</button>
      {notice && <span className="collection-share-toast">{notice}</span>}
    </span>
  );
}
