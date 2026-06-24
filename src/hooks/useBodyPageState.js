import { useEffect } from 'react';

const MANAGED_BODY_CLASSES = [
  'home-page',
  'genres-page',
  'detail-page',
  'recommendations-page',
  'dashboard-page',
  'login-page',
  'register-page',
  'admin-page',
  'admin-shell-page',
  'collections-page',
  'users-page',
  'logged-in',
  'guest',
];

export default function useBodyPageState(page, isLoggedIn) {
  useEffect(() => {
    document.body.classList.remove(...MANAGED_BODY_CLASSES);
    const pageClass = page === 'admin' ? 'admin-shell-page' : `${page}-page`;
    document.body.classList.add(pageClass, isLoggedIn ? 'logged-in' : 'guest');

    if (localStorage.getItem('cinemate-theme') === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }

    return () => document.body.classList.remove(...MANAGED_BODY_CLASSES);
  }, [page, isLoggedIn]);
}
