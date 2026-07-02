import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

function normaliseEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getEmailError(email = "") {
  const value = normaliseEmail(email);
  if (!value) return "Email is required.";
  if (!value.includes("@") || !value.includes(".")) {
    return "Please enter a valid email address.";
  }
  return "";
}

function getAuthProviders(authUser = {}) {
  const identities = Array.isArray(authUser?.identities)
    ? authUser.identities
    : [];
  const providers = identities
    .map((identity) => identity?.provider)
    .filter(Boolean);

  const mainProvider = authUser?.app_metadata?.provider;
  if (mainProvider && !providers.includes(mainProvider)) {
    providers.push(mainProvider);
  }

  return [...new Set(providers)].map((provider) =>
    provider === "email" ? "email" : provider,
  );
}

function userHasPassword(authUser = {}) {
  const providers = getAuthProviders(authUser);
  return (
    providers.includes("email") ||
    authUser?.user_metadata?.cinemate_password_enabled === true
  );
}

function getBearerToken(request) {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

async function verifyCurrentPassword(email, password) {
  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await verifyClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(
      "Current password is incorrect. Please check it and try again.",
    );
  }
}

export async function POST(request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Supabase public environment variables are missing." }, 500);
  }

  if (!serviceRoleKey) {
    return json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local and Vercel to update account email without Supabase email-rate-limit errors.",
        code: "SERVICE_ROLE_MISSING",
      },
      501,
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return json({ error: "Missing login session token." }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(
    token,
  );

  if (userError || !userData?.user?.id) {
    return json({ error: "Your session expired. Please log in again." }, 401);
  }

  const authUser = userData.user;
  let body = {};

  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid request body." }, 400);
  }

  const cleanEmail = body.email ? normaliseEmail(body.email) : "";
  const cleanPassword = String(body.password || "").trim();
  const userMetadata =
    body.userMetadata && typeof body.userMetadata === "object"
      ? body.userMetadata
      : {};
  const requirePasswordCheck = Boolean(body.requirePasswordCheck);
  const currentPassword = String(body.currentPassword || "");

  if (!cleanEmail && !cleanPassword && !Object.keys(userMetadata).length) {
    return json({ error: "No account changes were provided." }, 400);
  }

  if (cleanEmail) {
    const emailError = getEmailError(cleanEmail);
    if (emailError) return json({ error: emailError }, 400);
  }

  if (cleanPassword && cleanPassword.length < 6) {
    return json({ error: "New password must be at least 6 characters." }, 400);
  }

  const currentAuthEmail = normaliseEmail(authUser.email || "");
  const passwordAlreadyEnabled = userHasPassword(authUser);

  if (requirePasswordCheck || (cleanEmail && passwordAlreadyEnabled)) {
    if (!currentPassword) {
      return json(
        { error: "Please enter your current password to confirm this change." },
        400,
      );
    }

    try {
      await verifyCurrentPassword(currentAuthEmail, currentPassword);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const attributes = {};

  if (cleanEmail && cleanEmail !== currentAuthEmail) {
    attributes.email = cleanEmail;
    attributes.email_confirm = true;
  }

  if (cleanPassword) {
    attributes.password = cleanPassword;
  }

  if (Object.keys(userMetadata).length || cleanPassword) {
    attributes.user_metadata = {
      ...(authUser.user_metadata || {}),
      ...userMetadata,
      ...(cleanPassword ? { cinemate_password_enabled: true } : {}),
    };
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(
    authUser.id,
    attributes,
  );

  if (error) {
    return json(
      { error: error.message || "Could not update the Supabase Auth user." },
      400,
    );
  }

  return json({ user: data?.user || null });
}
