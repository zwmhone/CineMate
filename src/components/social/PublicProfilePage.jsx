'use client';

import usePublicProfile from '@/hooks/usePublicProfile';
import FollowButton from '@/components/social/FollowButton';
import FollowListModal from '@/components/social/FollowListModal';
import BlockedUsersModal from '@/components/social/BlockedUsersModal';
import PublicCollectionGrid from '@/components/social/PublicCollectionGrid';
import { useAuth } from '@/lib/AuthContext';

function profileInitial(name = '') {
  return String(name || 'CineMate User').trim().charAt(0).toUpperCase() || 'C';
}

function formatJoined(value = '') {
  if (!value) return 'Joined CineMate';
  try {
    return `Joined ${new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(value))}`;
  } catch {
    return 'Joined CineMate';
  }
}

function ProfileAvatar({ profile }) {
  if (profile?.profileImage) {
    return <img className="public-profile-avatar" src={profile.profileImage} alt={`${profile.name} profile`} loading="lazy" />;
  }
  return <span className="public-profile-avatar public-profile-avatar-fallback" aria-hidden="true">{profileInitial(profile?.name)}</span>;
}

export default function PublicProfilePage({ profileUserId }) {
  const { user } = useAuth();
  const {
    profile,
    stats,
    viewer,
    collections,
    loading,
    saving,
    error,
    notice,
    socialList,
    blockedList,
    toggleFollow,
    unblockProfile,
    openSocialList,
    closeSocialList,
    toggleFollowFromList,
    blockFromList,
    openBlockedList,
    closeBlockedList,
    unblockFromBlockedList,
  } = usePublicProfile(profileUserId);

  if (loading) {
    return (
      <main className="public-profile-page page-shell">
        <section className="glass-panel public-profile-state-card reveal">
          <p className="eyebrow">Public profile</p>
          <h1>Loading profile...</h1>
        </section>
      </main>
    );
  }

  if (error && !profile) {
    return (
      <main className="public-profile-page page-shell">
        <section className="glass-panel public-profile-state-card reveal">
          <p className="eyebrow">Public profile</p>
          <h1>Could not open profile</h1>
          <p className="meta">{error}</p>
          <a className="profile-follow-button secondary" href="/movies">Browse movies</a>
        </section>
      </main>
    );
  }

  return (
    <main className="public-profile-page page-shell">
      <section className="glass-panel public-profile-hero reveal">
        <div className="public-profile-main">
          <ProfileAvatar profile={profile} />
          <div>
            <p className="eyebrow">Public profile</p>
            <h1>{profile?.name || 'CineMate User'}</h1>
            <p className="meta">{formatJoined(profile?.joinedAt)}</p>
          </div>
        </div>
        <div className="public-profile-actions">
          <FollowButton
            isOwnProfile={viewer.isOwnProfile}
            isFollowing={viewer.isFollowing}
            isFollowedByTarget={viewer.isFollowedByTarget}
            isBlocked={viewer.isBlocked}
            saving={saving}
            onToggle={toggleFollow}
            onUnblock={unblockProfile}
          />
          {viewer.isOwnProfile && (
            <button
              type="button"
              className="profile-follow-button secondary blocked-users-open"
              onClick={openBlockedList}
            >
              Blocked Users
            </button>
          )}
          {notice && <span className="public-profile-notice inline">{notice}</span>}
        </div>
      </section>

      {error && <p className="collection-status public-profile-status">{error}</p>}

      <section className="public-profile-stats reveal" aria-label="Profile stats">
        <button type="button" className="glass-panel public-profile-stat stat-button" aria-label="Open followers list" onClick={() => openSocialList('followers')}>
          <strong>{stats.followers}</strong>
          <span>Followers</span>
          <small>View list</small>
        </button>
        <button type="button" className="glass-panel public-profile-stat stat-button" aria-label="Open following list" onClick={() => openSocialList('following')}>
          <strong>{stats.following}</strong>
          <span>Following</span>
          <small>View list</small>
        </button>
        <div className="glass-panel public-profile-stat">
          <strong>{stats.publicCollections}</strong>
          <span>Public Collections</span>
        </div>
      </section>

      <section className="public-profile-section reveal">
        <div className="public-profile-section-head">
          <p className="eyebrow">Shareable playlists</p>
          <h2>Public Collections</h2>
          <p className="meta">Only collections marked as shareable are shown here.</p>
        </div>
        <PublicCollectionGrid collections={collections} />
      </section>

      <BlockedUsersModal
        open={blockedList.open}
        users={blockedList.users}
        loading={blockedList.loading}
        error={blockedList.error}
        onClose={closeBlockedList}
        onUnblock={unblockFromBlockedList}
      />

      <FollowListModal
        open={socialList.open}
        type={socialList.type}
        users={socialList.users}
        loading={socialList.loading}
        error={socialList.error}
        viewerId={user?.id || ''}
        onClose={closeSocialList}
        onSwitch={openSocialList}
        onToggleFollow={toggleFollowFromList}
        onBlock={blockFromList}
      />
    </main>
  );
}
