"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  deleteUserAccountData,
  getProfileStats,
  getUserProfile,
  sendPasswordResetEmail,
  updateUserProfile,
} from "@/lib/profile";

export default function useProfile() {
  const router = useRouter();
  const { user, ready, logout, refreshUserProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadProfile = useCallback(async () => {
    if (!ready) return;
    if (!user?.id) {
      setProfile(null);
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [profileData, statsData] = await Promise.all([
        getUserProfile(user.id, user.raw),
        getProfileStats(user.id),
      ]);
      setProfile(profileData);
      setStats(statsData);
    } catch (loadError) {
      setError(loadError.message || "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, [ready, user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const clearStatus = useCallback(() => {
    setError("");
    setMessage("");
  }, []);

  async function saveProfile(payload) {
    if (!user?.id)
      return {
        success: false,
        error: "Please log in before updating your profile.",
      };

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updated = await updateUserProfile({ userId: user.id, ...payload });
      setProfile((current) => ({ ...current, ...updated }));
      await refreshUserProfile?.();

      if (updated?.message) {
        setMessage(updated.message);
      } else if (payload?.newPassword) {
        setMessage(
          profile?.hasPassword === false
            ? "Password set successfully. You can now sign in with email and password."
            : "Profile updated successfully. Your password has been changed.",
        );
      } else if (
        payload?.updateEmail &&
        payload?.email &&
        payload.email !== user.email
      ) {
        setMessage(
          "Profile updated successfully. Check your email if Supabase asks you to confirm the address change.",
        );
      } else {
        setMessage("Profile updated successfully.");
      }

      return { success: true, profile: updated };
    } catch (saveError) {
      const saveMessage = saveError.message || "Could not save your profile.";
      setError(saveMessage);
      return { success: false, error: saveMessage };
    } finally {
      setSaving(false);
    }
  }

  async function requestPasswordReset(email) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await sendPasswordResetEmail(
        email || profile?.email || user?.email || "",
      );
      setMessage(
        "Password reset email sent. Check your inbox and follow the link from Supabase.",
      );
      return { success: true };
    } catch (resetError) {
      const resetMessage =
        resetError.message || "Could not send password reset email.";
      setError(resetMessage);
      return { success: false, error: resetMessage };
    } finally {
      setSaving(false);
    }
  }

  async function logoutFromProfile() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await logout?.();
      if (!result?.success)
        throw new Error(result?.error || "Could not log out.");
      router.push("/");
      return { success: true };
    } catch (logoutError) {
      const logoutMessage = logoutError.message || "Could not log out.";
      setError(logoutMessage);
      return { success: false, error: logoutMessage };
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(payload = {}) {
    if (!user?.id)
      return {
        success: false,
        error: "Please log in before deleting your account.",
      };

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await deleteUserAccountData({ userId: user.id, ...payload });
      await logout?.();
      router.push("/");
      return { success: true };
    } catch (deleteError) {
      const deleteMessage =
        deleteError.message || "Could not delete your account data.";
      setError(deleteMessage);
      return { success: false, error: deleteMessage };
    } finally {
      setSaving(false);
    }
  }

  return {
    profile,
    stats,
    loading,
    saving,
    error,
    message,
    saveProfile,
    requestPasswordReset,
    logoutFromProfile,
    deleteAccount,
    clearStatus,
    reloadProfile: loadProfile,
  };
}
