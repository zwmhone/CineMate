'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

export default function RequireLogin({
  children,
  title = 'Login Required',
  message = 'Please log in to view this personalised page.',
}) {
  const { isLoggedIn, ready } = useAuth();

  if (!ready) {
    return (
      <main className="auth-required page-section">
        <section className="auth-required-card">
          <p className="eyebrow">Loading</p>
          <h1 className="gradient-text">Checking Session</h1>
          <p>Please wait while CineMate checks your login session.</p>
        </section>
      </main>
    );
  }

  if (isLoggedIn) return children;

  return (
    <main className="auth-required page-section">
      <section className="auth-required-card">
        <p className="eyebrow">Private area</p>
        <h1 className="gradient-text">{title}</h1>
        <p>{message}</p>
        <div className="auth-required-actions">
          <Link href="/login">Login</Link>
          <Link href="/register">Sign Up</Link>
        </div>
      </section>
    </main>
  );
}
