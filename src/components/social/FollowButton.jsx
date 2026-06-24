'use client';

export default function FollowButton({ isOwnProfile = false, isFollowing = false, isFollowedByTarget = false, isBlocked = false, saving = false, onToggle, onUnblock }) {
  if (isOwnProfile) {
    return <a className="profile-follow-button secondary" href="/profile">Edit Profile</a>;
  }

  if (isBlocked) {
    return (
      <button
        type="button"
        className="profile-follow-button blocked unblock"
        disabled={saving}
        onClick={onUnblock}
      >
        {saving ? 'Saving...' : 'Unblock'}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`profile-follow-button${isFollowing ? ' following' : ''}`}
      disabled={saving}
      onClick={onToggle}
    >
      {saving ? 'Saving...' : (isFollowing ? 'Following' : (isFollowedByTarget ? 'Follow Back' : 'Follow'))}
    </button>
  );
}
