"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getUserProfile } from "@/lib/profile";
import { normaliseEmail } from "@/utils/emailValidation";

const AuthContext = createContext(null);

function isSafeDbProfileImage(value) {
  if (!value) return null;
  const image = String(value);
  return image.length <= 255 && !image.startsWith("data:") ? image : null;
}

function formatUser(supabaseUser, profileRow = null) {
  if (!supabaseUser) return null;

  const metadata = supabaseUser.user_metadata || {};
  const email = profileRow?.email || supabaseUser.email || "";

  return {
    id: supabaseUser.id,
    name:
      profileRow?.fullName ||
      metadata.full_name ||
      metadata.name ||
      email?.split("@")[0] ||
      "CineMate User",
    email,
    avatarUrl: profileRow?.profileImage || metadata.avatar_url || null,
    role: profileRow?.role || "user",
    isAdmin: profileRow?.isAdmin || profileRow?.role === "admin",
    isBanned: Boolean(profileRow?.isBanned),
    banReason: profileRow?.banReason || "",
    raw: supabaseUser,
  };
}

async function formatUserWithProfile(supabaseUser) {
  if (!supabaseUser) return null;

  try {
    const profile = await getUserProfile(supabaseUser.id, supabaseUser);
    return formatUser(supabaseUser, profile);
  } catch (error) {
    console.warn("Profile row could not be loaded:", error.message);
    return formatUser(supabaseUser);
  }
}

function getFriendlyAuthError(error) {
  const rawMessage =
    typeof error === "string"
      ? error
      : error?.message || "Something went wrong. Please try again.";
  const message = rawMessage.toLowerCase();

  if (message.includes("email rate limit") || message.includes("rate limit")) {
    return "Too many signup or login attempts were made. Please wait a few minutes before trying again.";
  }

  if (
    message.includes("already registered") ||
    message.includes("user already registered") ||
    message.includes("already exists")
  ) {
    return "This email is already registered. Please log in instead.";
  }

  if (message.includes("invalid login credentials")) {
    return "The email or password is incorrect. Please check your details and try again.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email address first, then log in.";
  }

  if (message.includes("email") && message.includes("invalid")) {
    return "Supabase rejected this email address. CineMate accepts custom domains, but the address still needs to use a real email domain that Supabase accepts.";
  }

  if (
    message.includes("password should be at least") ||
    message.includes("weak password")
  ) {
    return "Password is too weak. Please use at least 6 characters.";
  }

  if (message.includes("signup is disabled")) {
    return "Sign up is currently disabled in Supabase settings.";
  }

  if (
    message.includes("provider is not enabled") ||
    message.includes("provider not enabled")
  ) {
    return "Google sign-in is not enabled yet. Enable the Google provider in Supabase Auth settings first.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "Network error. Please check your internet connection and try again.";
  }

  return rawMessage;
}

function isInvalidRefreshToken(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found")
  );
}

async function clearBrokenLocalSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (_) {
    // Ignore local cleanup errors. The app state is cleared below.
  }
}

function notifyBannedUser(reason = "") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("cinemate:account-banned", {
      detail: reason || "This account has been banned by an administrator.",
    }),
  );
}

async function createProfileIfPossible(supabaseUser, name) {
  if (!supabaseUser?.id) return;

  const metadata = supabaseUser.user_metadata || {};
  const fallbackName =
    name ||
    metadata.full_name ||
    metadata.name ||
    supabaseUser.email?.split("@")[0] ||
    "CineMate User";
  const fallbackImage = isSafeDbProfileImage(metadata.avatar_url);

  const { data: existing, error: readError } = await supabase
    .from("users")
    .select("user_id,full_name,email,profile_image")
    .eq("user_id", supabaseUser.id)
    .maybeSingle();

  if (readError && !/multiple|no rows/i.test(readError.message || "")) {
    console.warn("User row could not be checked:", readError.message);
  }

  const payload = {
    user_id: supabaseUser.id,
    full_name: existing?.full_name || fallbackName,
    email: existing?.email || supabaseUser.email,
    profile_image: existing?.profile_image || fallbackImage,
  };

  const { error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.warn("User row was not created:", error.message);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        if (isInvalidRefreshToken(error)) {
          console.warn("Clearing expired Supabase session:", error.message);
          await clearBrokenLocalSession();
        } else {
          console.error("Failed to load Supabase session:", error.message);
        }
        setSession(null);
        setUser(null);
      } else {
        const formatted = await formatUserWithProfile(data.session?.user);
        if (formatted?.isBanned) {
          notifyBannedUser(formatted.banReason);
          await clearBrokenLocalSession();
          setSession(null);
          setUser(null);
        } else {
          setSession(data.session || null);
          setUser(formatted);
        }
      }

      setReady(true);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "cinemate_password_recovery_active",
          "true",
        );
        if (window.location.pathname !== "/profile") {
          window.location.replace("/profile?resetPassword=true");
          return;
        }

        if (!window.location.search.includes("resetPassword=true")) {
          window.history.replaceState(null, "", "/profile?resetPassword=true");
        }
      }

      const formatted = await formatUserWithProfile(nextSession?.user);
      if (formatted?.isBanned) {
        notifyBannedUser(formatted.banReason);
        await clearBrokenLocalSession();
        setSession(null);
        setUser(null);
        setReady(true);
        return;
      }

      setSession(nextSession || null);
      setUser(formatted);
      setReady(true);

      if (
        (event === "SIGNED_IN" ||
          event === "USER_UPDATED" ||
          event === "PASSWORD_RECOVERY") &&
        nextSession?.user
      ) {
        await createProfileIfPossible(
          nextSession.user,
          nextSession.user.user_metadata?.full_name ||
            nextSession.user.user_metadata?.name,
        );
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signUp({ name, email, password }) {
    try {
      const cleanName = name?.trim();
      const cleanEmail = normaliseEmail(email);

      // Supabase can hide duplicate signup errors when email confirmation is enabled.
      // Check the public users table first when it is readable, then still keep the
      // identities check below as a second safety net.
      const { data: existingUser } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", cleanEmail)
        .limit(1)
        .maybeSingle();

      if (existingUser?.user_id) {
        return {
          success: false,
          error: "This email is already registered. Please log in instead.",
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            name: cleanName,
          },
        },
      });

      if (error) {
        return { success: false, error: getFriendlyAuthError(error) };
      }

      if (
        Array.isArray(data.user?.identities) &&
        data.user.identities.length === 0
      ) {
        return {
          success: false,
          error: "This email is already registered. Please log in instead.",
        };
      }

      if (data.session?.user) {
        await createProfileIfPossible(data.session.user, cleanName);
        setSession(data.session);
        setUser(await formatUserWithProfile(data.session.user));
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
        needsEmailConfirmation: Boolean(data.user && !data.session),
      };
    } catch (error) {
      return { success: false, error: getFriendlyAuthError(error) };
    }
  }

  async function login({ email, password }) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normaliseEmail(email),
        password,
      });

      if (error) {
        return { success: false, error: getFriendlyAuthError(error) };
      }

      const formatted = await formatUserWithProfile(data.user);
      if (formatted?.isBanned) {
        const reason =
          formatted.banReason ||
          "This account has been banned by an administrator.";
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setSession(null);
        setUser(null);
        return { success: false, banned: true, error: reason };
      }

      setSession(data.session || null);
      setUser(formatted);

      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      return { success: false, error: getFriendlyAuthError(error) };
    }
  }

  async function continueWithGoogle() {
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/`
          : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        return { success: false, error: getFriendlyAuthError(error) };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: getFriendlyAuthError(error) };
    }
  }

  async function refreshUserProfile() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      if (error) {
        if (isInvalidRefreshToken(error)) {
          await clearBrokenLocalSession();
          setSession(null);
          setUser(null);
        } else {
          console.warn("Could not refresh profile:", error.message);
        }
      }
      return null;
    }

    const formatted = await formatUserWithProfile(data.user);
    setUser(formatted);
    return formatted;
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error && !isInvalidRefreshToken(error)) {
      console.error("Failed to log out:", error.message);
      return { success: false, error: getFriendlyAuthError(error) };
    }

    if (error && isInvalidRefreshToken(error)) {
      await clearBrokenLocalSession();
    }

    setSession(null);
    setUser(null);
    return { success: true };
  }

  const value = useMemo(
    () => ({
      user,
      session,
      isLoggedIn: Boolean(user),
      ready,
      signUp,
      login,
      continueWithGoogle,
      logout,
      refreshUserProfile,
      setUser,
    }),
    [user, session, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
