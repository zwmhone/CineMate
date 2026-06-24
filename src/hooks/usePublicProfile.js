'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  blockUser,
  getPublicProfileBundle,
  listFollowProfiles,
  listBlockedProfiles,
  toggleFollowUser,
  unblockUser,
} from '@/lib/follows';

export default function usePublicProfile(profileUserId) {
  const { user, ready } = useAuth();
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [socialList, setSocialList] = useState({ open: false, type: 'followers', loading: false, error: '', users: [] });
  const [blockedList, setBlockedList] = useState({ open: false, loading: false, error: '', users: [] });

  const viewerId = user?.id || null;

  const loadProfile = useCallback(async () => {
    if (!profileUserId) {
      setBundle(null);
      setError('User profile is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const nextBundle = await getPublicProfileBundle(profileUserId, viewerId);
      setBundle(nextBundle);
    } catch (nextError) {
      setBundle(null);
      setError(nextError.message || 'Could not load this profile.');
    } finally {
      setLoading(false);
    }
  }, [profileUserId, viewerId]);

  useEffect(() => {
    if (!ready) return;
    loadProfile();
  }, [ready, loadProfile]);

  function requireLogin(message) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cinemate:require-login', { detail: message }));
    }
  }

  async function toggleFollow() {
    if (!viewerId) {
      requireLogin('Please log in before following users.');
      return;
    }

    if (!bundle?.profile?.id || bundle.viewer?.isOwnProfile || bundle.viewer?.isBlocked) return;

    const wasFollowing = Boolean(bundle.viewer?.isFollowing);
    setSaving(true);
    setNotice('');
    setError('');

    setBundle(current => current ? {
      ...current,
      stats: {
        ...current.stats,
        followers: Math.max(0, Number(current.stats?.followers || 0) + (wasFollowing ? -1 : 1)),
      },
      viewer: {
        ...current.viewer,
        isFollowing: !wasFollowing,
      },
    } : current);

    try {
      await toggleFollowUser(bundle.profile.id, viewerId, wasFollowing);
      setNotice(wasFollowing ? 'Unfollowed user.' : 'Following user.');
      window.setTimeout(() => setNotice(''), 2400);
    } catch (nextError) {
      setBundle(current => current ? {
        ...current,
        stats: {
          ...current.stats,
          followers: Math.max(0, Number(current.stats?.followers || 0) + (wasFollowing ? 1 : -1)),
        },
        viewer: {
          ...current.viewer,
          isFollowing: wasFollowing,
        },
      } : current);
      setError(nextError.message || 'Could not update follow status.');
    } finally {
      setSaving(false);
    }
  }


  async function unblockProfile() {
    if (!viewerId) {
      requireLogin('Please log in before unblocking users.');
      return;
    }
    if (!bundle?.profile?.id || bundle.viewer?.isOwnProfile || !bundle.viewer?.isBlocked) return;

    setSaving(true);
    setNotice('');
    setError('');

    setBundle(current => current ? {
      ...current,
      viewer: {
        ...current.viewer,
        isBlocked: false,
      },
    } : current);

    try {
      await unblockUser(bundle.profile.id, viewerId);
      setNotice('User unblocked.');
      window.setTimeout(() => setNotice(''), 2400);
      await loadProfile();
    } catch (nextError) {
      setBundle(current => current ? {
        ...current,
        viewer: {
          ...current.viewer,
          isBlocked: true,
        },
      } : current);
      setError(nextError.message || 'Could not unblock this user.');
    } finally {
      setSaving(false);
    }
  }

  const openSocialList = useCallback(async (type = 'followers') => {
    const nextType = type === 'following' ? 'following' : 'followers';
    if (!profileUserId) return;

    setSocialList({ open: true, type: nextType, loading: true, error: '', users: [] });
    try {
      const users = await listFollowProfiles(profileUserId, nextType, viewerId);
      setSocialList({ open: true, type: nextType, loading: false, error: '', users });
    } catch (nextError) {
      setSocialList({ open: true, type: nextType, loading: false, error: nextError.message || 'Could not load users.', users: [] });
    }
  }, [profileUserId, viewerId]);

  function closeSocialList() {
    setSocialList(current => ({ ...current, open: false }));
  }


  const openBlockedList = useCallback(async () => {
    if (!viewerId) {
      requireLogin('Please log in before managing blocked users.');
      return;
    }

    setBlockedList({ open: true, loading: true, error: '', users: [] });
    try {
      const users = await listBlockedProfiles(viewerId);
      setBlockedList({ open: true, loading: false, error: '', users });
    } catch (nextError) {
      setBlockedList({ open: true, loading: false, error: nextError.message || 'Could not load blocked users.', users: [] });
    }
  }, [viewerId]);

  function closeBlockedList() {
    setBlockedList(current => ({ ...current, open: false }));
  }

  async function unblockFromBlockedList(targetUserId) {
    if (!viewerId) {
      requireLogin('Please log in before unblocking users.');
      return;
    }
    if (!targetUserId || targetUserId === viewerId) return;

    setBlockedList(current => ({
      ...current,
      users: current.users.filter(item => item.id !== targetUserId),
    }));

    try {
      await unblockUser(targetUserId, viewerId);
      await loadProfile();
    } catch (nextError) {
      setBlockedList(current => ({
        ...current,
        error: nextError.message || 'Could not unblock this user.',
      }));
      await openBlockedList();
    }
  }

  async function toggleFollowFromList(targetUserId, currentlyFollowing = false) {
    if (!viewerId) {
      requireLogin('Please log in before following users.');
      return;
    }
    if (!targetUserId || targetUserId === viewerId) return;

    setSocialList(current => ({
      ...current,
      users: current.users.map(item => item.id === targetUserId ? { ...item, viewerFollows: !currentlyFollowing } : item),
    }));

    try {
      await toggleFollowUser(targetUserId, viewerId, currentlyFollowing);
      if (targetUserId === profileUserId) {
        await loadProfile();
      }
    } catch (nextError) {
      setSocialList(current => ({
        ...current,
        error: nextError.message || 'Could not update follow status.',
        users: current.users.map(item => item.id === targetUserId ? { ...item, viewerFollows: currentlyFollowing } : item),
      }));
    }
  }

  async function blockFromList(targetUserId) {
    if (!viewerId) {
      requireLogin('Please log in before blocking users.');
      return;
    }
    if (!targetUserId || targetUserId === viewerId) return;

    const target = socialList.users.find(item => item.id === targetUserId);
    const wasBlocked = Boolean(target?.viewerBlocked);

    setSocialList(current => ({
      ...current,
      users: current.users.map(item => item.id === targetUserId ? {
        ...item,
        viewerBlocked: !wasBlocked,
        viewerFollows: wasBlocked ? item.viewerFollows : false,
      } : item),
    }));

    try {
      if (wasBlocked) {
        await unblockUser(targetUserId, viewerId);
      } else {
        await blockUser(targetUserId, viewerId);
      }
      await loadProfile();
      await openSocialList(socialList.type);
    } catch (nextError) {
      setSocialList(current => ({
        ...current,
        error: nextError.message || 'Could not update block status.',
        users: current.users.map(item => item.id === targetUserId ? {
          ...item,
          viewerBlocked: wasBlocked,
          viewerFollows: target?.viewerFollows || false,
        } : item),
      }));
    }
  }

  return {
    bundle,
    profile: bundle?.profile || null,
    stats: bundle?.stats || { followers: 0, following: 0, publicCollections: 0 },
    viewer: bundle?.viewer || { isOwnProfile: false, isFollowing: false, isFollowedByTarget: false, isBlocked: false },
    collections: bundle?.collections || [],
    loading: loading || !ready,
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
    refresh: loadProfile,
  };
}
