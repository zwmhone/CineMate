import { supabase } from "@/lib/supabaseClient";
import { getLooseEmailError, normaliseEmail } from "@/utils/emailValidation";

const PROFILE_IMAGE_BUCKET = "profile-images";

function fallbackNameFromEmail(email = "") {
  return email?.split("@")?.[0] || "CineMate User";
}

function getAuthProviders(authUser = {}) {
  const identities = Array.isArray(authUser?.identities)
    ? authUser.identities
    : [];
  const providers = identities
    .map((identity) => identity?.provider)
    .filter(Boolean);

  const mainProvider = authUser?.app_metadata?.provider;
  if (mainProvider && !providers.includes(mainProvider))
    providers.push(mainProvider);

  return [...new Set(providers)].map((provider) =>
    provider === "email" ? "email" : provider,
  );
}

function userHasPassword(authUser = {}) {
  const providers = getAuthProviders(authUser);
  const metadata = authUser?.user_metadata || {};
  return (
    providers.includes("email") || metadata.cinemate_password_enabled === true
  );
}

function isDataImage(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function isSafeProfileImage(value) {
  if (!value) return false;
  const image = String(value);
  return image.length <= 255 && !image.startsWith("data:");
}

function normaliseProfile(row = {}, authUser = {}) {
  const metadata = authUser?.user_metadata || {};
  const email = row.email || authUser?.email || "";
  const dbImage = isSafeProfileImage(row.profile_image)
    ? row.profile_image
    : null;
  const metadataImage = isSafeProfileImage(metadata.avatar_url)
    ? metadata.avatar_url
    : null;

  return {
    userId: row.user_id || authUser?.id || "",
    fullName:
      row.full_name ||
      metadata.full_name ||
      metadata.name ||
      fallbackNameFromEmail(email),
    email,
    profileImage: dbImage || metadataImage || null,
    createdAt: row.created_at || authUser?.created_at || null,
    authProviders: getAuthProviders(authUser),
    hasPassword: userHasPassword(authUser),
    role: row.role || "user",
    isAdmin: row.role === "admin",
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason || "",
  };
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function uploadProfileImage(userId, profileImage) {
  if (!profileImage) return null;
  if (!isDataImage(profileImage))
    return isSafeProfileImage(profileImage) ? profileImage : null;

  const blob = await dataUrlToBlob(profileImage);
  const extension = blob.type.includes("png") ? "png" : "jpg";
  const path = `avatars/${userId}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .upload(path, blob, {
      upsert: true,
      cacheControl: "3600",
      contentType: blob.type || "image/jpeg",
    });

  if (error) {
    throw new Error(
      `Could not upload profile picture. Run profile_storage_setup.sql once in Supabase, then try again.`,
    );
  }

  const { data } = supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .getPublicUrl(path);
  const publicUrl = data?.publicUrl || null;

  if (!isSafeProfileImage(publicUrl)) {
    throw new Error(
      "Profile image URL is too long for the current users.profile_image column.",
    );
  }

  return publicUrl;
}

async function safeCount(table, queryBuilder) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  query = queryBuilder ? queryBuilder(query) : query;
  const { count, error } = await query;

  if (error) {
    console.warn(`Could not count ${table}:`, error.message);
    return 0;
  }

  return count || 0;
}

async function readProfileRow(userId) {
  let result = await supabase
    .from("users")
    .select(
      "user_id,full_name,email,profile_image,created_at,role,is_banned,ban_reason",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (
    result.error &&
    /role|is_banned|ban_reason|column/i.test(result.error.message || "")
  ) {
    result = await supabase
      .from("users")
      .select("user_id,full_name,email,profile_image,created_at")
      .eq("user_id", userId)
      .maybeSingle();
  }

  return result;
}

export async function getUserProfile(userId, authUser = null) {
  if (!userId) return null;

  const { data, error } = await readProfileRow(userId);

  if (error && !/multiple|no rows/i.test(error.message || "")) {
    throw new Error(error.message);
  }

  if (data) return normaliseProfile(data, authUser || {});

  const metadata = authUser?.user_metadata || {};
  const fallbackImage = isSafeProfileImage(metadata.avatar_url)
    ? metadata.avatar_url
    : null;
  const fallbackRow = {
    user_id: userId,
    full_name:
      metadata.full_name ||
      metadata.name ||
      fallbackNameFromEmail(authUser?.email),
    email: authUser?.email || "",
    profile_image: fallbackImage,
    role: "user",
    is_banned: false,
    ban_reason: "",
  };

  const { data: created, error: upsertError } = await supabase
    .from("users")
    .upsert(fallbackRow, { onConflict: "user_id" })
    .select("user_id,full_name,email,profile_image,created_at")
    .maybeSingle();

  if (upsertError) {
    console.warn("Could not create profile row:", upsertError.message);
    return normaliseProfile(fallbackRow, authUser || {});
  }

  return normaliseProfile(created || fallbackRow, authUser || {});
}

async function saveProfileRow({ userId, fullName, email, profileImage }) {
  const payload = {
    user_id: userId,
    full_name: fullName,
    email,
    profile_image: profileImage || null,
  };

  let result = await supabase
    .from("users")
    .update({
      full_name: payload.full_name,
      email: payload.email,
      profile_image: payload.profile_image,
    })
    .eq("user_id", userId)
    .select(
      "user_id,full_name,email,profile_image,created_at,role,is_banned,ban_reason",
    )
    .maybeSingle();

  if (!result.error && result.data) return result.data;
  if (result.error) throw new Error(result.error.message);

  result = await supabase
    .from("users")
    .upsert(payload, { onConflict: "user_id" })
    .select(
      "user_id,full_name,email,profile_image,created_at,role,is_banned,ban_reason",
    )
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return result.data || payload;
}

function isInvalidSupabaseEmailError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("email") && message.includes("invalid");
}

async function reauthenticateUser(currentEmail, currentPassword) {
  const email = String(currentEmail || "")
    .trim()
    .toLowerCase();
  const password = String(currentPassword || "");

  if (!email || !password) {
    throw new Error(
      "Please enter your current password to change your email or password.",
    );
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      "Current password is incorrect. Please check it and try again.",
    );
  }
}

export async function updateUserProfile({
  userId,
  fullName,
  email,
  profileImage,
  currentPassword = "",
  newPassword = "",
  requiresCurrentPassword = false,
  recoveryMode = false,
  updateEmail = false,
}) {
  if (!userId) throw new Error("Please log in before updating your profile.");

  const cleanName = String(fullName || "").trim();
  const cleanEmail = normaliseEmail(email);
  const cleanPassword = String(newPassword || "").trim();
  const cleanCurrentPassword = String(currentPassword || "");
  const shouldUpdateEmail = Boolean(updateEmail);

  if (cleanName.length < 2)
    throw new Error("Please enter a display name with at least 2 characters.");

  if (shouldUpdateEmail) {
    const emailError = getLooseEmailError(cleanEmail);
    if (emailError) throw new Error(emailError);
  }

  if (cleanPassword && cleanPassword.length < 6)
    throw new Error("New password must be at least 6 characters.");

  const { data: authData, error: authReadError } =
    await supabase.auth.getUser();
  if (authReadError) throw new Error(authReadError.message);

  const authUser = authData?.user;
  const currentAuthEmail = normaliseEmail(authUser?.email || "");
  const emailChanged =
    shouldUpdateEmail &&
    cleanEmail &&
    currentAuthEmail &&
    cleanEmail !== currentAuthEmail;
  const passwordChanged = Boolean(cleanPassword);
  const savedEmail =
    shouldUpdateEmail && emailChanged
      ? cleanEmail
      : cleanEmail || currentAuthEmail;

  if (shouldUpdateEmail && !emailChanged) {
    throw new Error("Enter a different email address before saving.");
  }

  if (shouldUpdateEmail && !requiresCurrentPassword) {
    throw new Error(
      "Please set a CineMate password first, then use it to confirm email changes.",
    );
  }

  if (
    emailChanged ||
    (passwordChanged && requiresCurrentPassword && !recoveryMode)
  ) {
    await reauthenticateUser(currentAuthEmail, cleanCurrentPassword);
  }

  const uploadedProfileImage = await uploadProfileImage(userId, profileImage);

  const metadataPayload = {
    full_name: cleanName,
    name: cleanName,
    avatar_url: uploadedProfileImage || null,
  };

  if (passwordChanged) {
    metadataPayload.cinemate_password_enabled = true;
  }

  // Profile-only edits must work for Google OAuth users too.
  // Save the public.users row first and do not depend on Supabase Auth metadata.
  if (!shouldUpdateEmail && !passwordChanged) {
    const profileRow = await saveProfileRow({
      userId,
      fullName: cleanName,
      email: savedEmail,
      profileImage: uploadedProfileImage,
    });

    const authUpdate = await supabase.auth.updateUser({
      data: metadataPayload,
    });
    if (authUpdate.error) {
      console.warn(
        "Profile row saved, but Supabase Auth metadata was not updated:",
        authUpdate.error.message,
      );
    }

    return normaliseProfile(
      profileRow,
      authUpdate.data?.user || authUser || {},
    );
  }

  const authPayload = { data: metadataPayload };
  if (emailChanged) authPayload.email = cleanEmail;
  if (passwordChanged) authPayload.password = cleanPassword;

  const authUpdate = await supabase.auth.updateUser(authPayload);

  // Supabase Auth can reject unusual/custom test emails even when CineMate accepts them.
  // In that case, still save the email in public.users so the profile page works,
  // but keep the actual Supabase login email unchanged.
  if (
    authUpdate.error &&
    emailChanged &&
    isInvalidSupabaseEmailError(authUpdate.error)
  ) {
    const profileRow = await saveProfileRow({
      userId,
      fullName: cleanName,
      email: cleanEmail,
      profileImage: uploadedProfileImage,
    });

    return {
      ...normaliseProfile(profileRow, authUser || {}),
      loginEmailUpdated: false,
      message:
        "Profile email saved in CineMate. Supabase Auth rejected this address for login, so keep using your previous login email to sign in.",
    };
  }

  if (authUpdate.error) {
    throw new Error(
      authUpdate.error.message ||
        "Could not update your Supabase auth account.",
    );
  }

  const profileRow = await saveProfileRow({
    userId,
    fullName: cleanName,
    email: savedEmail,
    profileImage: uploadedProfileImage,
  });

  return {
    ...normaliseProfile(profileRow, authUpdate.data?.user || authUser || {}),
    loginEmailUpdated: emailChanged ? true : undefined,
  };
}

async function removeProfileImageFiles(userId) {
  if (!userId) return;

  try {
    const { data, error } = await supabase.storage
      .from(PROFILE_IMAGE_BUCKET)
      .list("avatars", { limit: 100, search: userId });

    if (error || !Array.isArray(data) || data.length === 0) return;

    const files = data
      .map((item) => item?.name)
      .filter(
        (name) => typeof name === "string" && name.startsWith(`${userId}-`),
      )
      .map((name) => `avatars/${name}`);

    if (files.length > 0) {
      await supabase.storage.from(PROFILE_IMAGE_BUCKET).remove(files);
    }
  } catch (error) {
    console.warn(
      "Could not remove profile image files before account deletion:",
      error?.message || error,
    );
  }
}

export async function deleteUserAccountData({
  userId,
  currentPassword = "",
  requiresCurrentPassword = false,
}) {
  if (!userId) throw new Error("Please log in before deleting your account.");

  const { data: authData, error: authReadError } =
    await supabase.auth.getUser();
  if (authReadError) throw new Error(authReadError.message);

  const authUser = authData?.user;
  const currentAuthEmail = normaliseEmail(authUser?.email || "");

  if (requiresCurrentPassword) {
    await reauthenticateUser(currentAuthEmail, currentPassword);
  }

  // Remove profile image files with the official Supabase Storage API.
  // The database function must not delete from storage.objects directly.
  await removeProfileImageFiles(userId);

  // A browser client cannot permanently remove a row from auth.users by itself.
  // The delete_my_account() RPC is a safe SECURITY DEFINER database function that
  // deletes this user's CineMate rows first, then removes the Supabase Auth user.
  // This lets the same email be used again for a fresh account.
  const { error: rpcError } = await supabase.rpc("delete_my_account");

  if (rpcError) {
    const message = String(rpcError.message || "");
    if (
      /function.*delete_my_account|could not find|not found|schema cache/i.test(
        message,
      )
    ) {
      throw new Error(
        "Account deletion needs the latest Supabase setup step. Run account_delete_setup.sql once, then try again.",
      );
    }

    throw new Error(
      message ||
        "Could not permanently delete your account. Run the latest account_delete_setup.sql, then try again.",
    );
  }

  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  return true;
}

export async function sendPasswordResetEmail(email) {
  const cleanEmail = normaliseEmail(email);
  const emailError = getLooseEmailError(cleanEmail);
  if (emailError) throw new Error("Please enter a valid email address first.");

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/profile?resetPassword=true`
      : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  });

  if (error) throw new Error(error.message);
  return true;
}

export async function getProfileStats(userId) {
  if (!userId) {
    return {
      favourites: 0,
      watched: 0,
      wishlist: 0,
      ratings: 0,
      reviews: 0,
      averageRating: "0.0",
    };
  }

  const [favourites, watched, wishlist, ratings, commentsResult] =
    await Promise.all([
      safeCount("favourites", (query) => query.eq("user_id", userId)),
      safeCount("watch_states", (query) =>
        query.eq("user_id", userId).eq("status", "watched"),
      ),
      safeCount("watch_states", (query) =>
        query.eq("user_id", userId).eq("status", "wishlist"),
      ),
      safeCount("ratings", (query) => query.eq("user_id", userId)),
      supabase.from("comments").select("comment_text").eq("user_id", userId),
    ]);

  const reviews = commentsResult.error
    ? 0
    : (commentsResult.data || []).filter(
        (comment) => String(comment.comment_text || "").trim().length > 0,
      ).length;

  const { data: ratingRows, error: ratingError } = await supabase
    .from("ratings")
    .select("rating_value")
    .eq("user_id", userId);

  const averageRating =
    ratingError || !ratingRows?.length
      ? "0.0"
      : (
          ratingRows.reduce(
            (sum, row) => sum + Number(row.rating_value || 0),
            0,
          ) / ratingRows.length
        ).toFixed(1);

  return {
    favourites,
    watched,
    wishlist,
    ratings,
    reviews,
    averageRating,
  };
}
