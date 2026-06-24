'use client';

import { useState } from 'react';

function collectionInitial(title = '') {
  return String(title || 'C').trim().charAt(0).toUpperCase() || 'C';
}

function coverStyle(collection = {}) {
  const poster = collection.coverPoster || collection.coverMovie?.poster || collection.coverMovie?.posterUrl || '';
  return poster ? { backgroundImage: `linear-gradient(180deg, rgba(8, 2, 16, 0.05), rgba(8, 2, 16, 0.78)), url(${poster})` } : undefined;
}

async function copyText(value) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}

export default function PublicCollectionGrid({ collections = [] }) {
  const [notice, setNotice] = useState('');

  async function handleShare(collectionId) {
    try {
      const link = `${window.location.origin}/collections/${collectionId}`;
      await copyText(link);
      setNotice('Collection link copied!');
      window.setTimeout(() => setNotice(''), 2400);
    } catch {
      setNotice('Could not copy link.');
      window.setTimeout(() => setNotice(''), 2400);
    }
  }

  if (!collections.length) {
    return <p className="meta public-profile-empty">No public collections yet.</p>;
  }

  return (
    <>
      {notice && <p className="public-profile-notice">{notice}</p>}
      <div className="public-collection-grid">
        {collections.map(collection => (
          <article key={collection.id} className="public-collection-card">
            <div className={`public-collection-cover${collection.coverPoster ? ' has-poster' : ''}`} style={coverStyle(collection)}>
              {!collection.coverPoster && <span>{collectionInitial(collection.title)}</span>}
              {collection.coverPoster && <em>Newest added</em>}
            </div>
            <div className="public-collection-body">
              <span className="collection-visibility">Shareable</span>
              <h3>{collection.title}</h3>
              <p>{collection.description || 'A public CineMate collection.'}</p>
              <strong>{collection.itemCount} title{collection.itemCount === 1 ? '' : 's'}</strong>
              <div className="public-collection-actions">
                <a href={`/collections/${collection.id}`} className="collection-open-button">Open</a>
                <button type="button" onClick={() => handleShare(collection.id)}>Copy Link</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
