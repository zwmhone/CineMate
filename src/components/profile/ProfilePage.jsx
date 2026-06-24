'use client';

import Link from 'next/link';
import useProfile from '@/hooks/useProfile';
import ProfileForm from './ProfileForm';
import ProfileStats from './ProfileStats';

function formatMemberSince(dateValue) {
  if (!dateValue) return 'Recently joined';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Recently joined';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function ProfilePage() {
  const { profile, stats, loading, saving, error, message, saveProfile, requestPasswordReset, logoutFromProfile, deleteAccount, clearStatus } = useProfile();

  if (loading) {
    return (
      <main>
        <section className="profile-page page-section">
          <div className="profile-loading-card glass-panel">
            <p className="eyebrow">Profile</p>
            <h1 className="gradient-text">Loading Profile</h1>
            <p className="meta">Please wait while CineMate loads your account details.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="profile-page page-section">
        <div className="section-heading profile-page-heading">
          <div>
            <p className="eyebrow">Your Account</p>
            <h2>Profile</h2>
            <p className="profile-heading-copy">
              Manage your CineMate identity and review your personal viewing stats in one place.
            </p>
          </div>
          <Link className="profile-back-link" href="/dashboard">View Dashboard</Link>
        </div>

        {error ? <p className="profile-error" role="alert">{error}</p> : null}
        {message ? <p className="profile-success" role="status">{message}</p> : null}

        <div className="profile-page-layout">
          <ProfileForm
            profile={profile}
            saving={saving}
            onSave={saveProfile}
            onResetPassword={requestPasswordReset}
            onLogout={logoutFromProfile}
            onDeleteAccount={deleteAccount}
            onClearStatus={clearStatus}
          />

          <aside className="profile-overview glass-panel">
            <div className="profile-overview-top">
              <div className="profile-overview-avatar">
                {profile?.profileImage ? <img alt="Profile" src={profile.profileImage} /> : <span>{profile?.fullName?.charAt(0)?.toUpperCase() || 'C'}</span>}
              </div>
              <div>
                <h3>{profile?.fullName || 'CineMate User'}</h3>
                <p>{profile?.email}</p>
                <small>Member since {formatMemberSince(profile?.createdAt)}</small>
              </div>
            </div>

            <ProfileStats stats={stats} />

            <div className="profile-note-card">
              <strong>Personalisation</strong>
              <p>
                Your favourites, ratings, watch status, comments and recommendation feedback help CineMate build a stronger taste profile.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
