"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getLooseEmailError, normaliseEmail } from "@/utils/emailValidation";

function getEmailError(email) {
  return getLooseEmailError(email);
}

function getPasswordError(password) {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return "";
}

export default function AuthForm({ mode }) {
  const signup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signUp, login, continueWithGoogle } = useAuth();
  const router = useRouter();

  const cleanName = name.trim();
  const cleanEmail = normaliseEmail(email);

  const validation = useMemo(() => {
    const next = {
      name: signup && cleanName.length < 2 ? "Please enter your name." : "",
      email: getEmailError(email),
      password: getPasswordError(password),
      confirmPassword:
        signup && password !== confirmPassword ? "Passwords do not match." : "",
    };

    const blockingErrors = signup
      ? [next.name, next.email, next.password, next.confirmPassword]
      : [next.email, next.password];

    return {
      ...next,
      isValid: blockingErrors.every((item) => !item),
    };
  }, [signup, cleanName, email, password, confirmPassword]);

  function clearStatus() {
    setError("");
    setMessage("");
  }

  function markTouched(field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function showFieldError(field) {
    return touched[field] && validation[field];
  }

  async function submit(e) {
    e.preventDefault();
    clearStatus();

    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (!validation.isValid) {
      setError(
        signup
          ? "Please fix the highlighted fields before creating an account."
          : "Please fix the highlighted fields before logging in.",
      );
      return;
    }

    setLoading(true);

    try {
      const result = signup
        ? await signUp({ name: cleanName, email: cleanEmail, password })
        : await login({ email: cleanEmail, password });

      if (!result.success) {
        if (result.banned) {
          window.dispatchEvent(
            new CustomEvent("cinemate:account-banned", {
              detail:
                result.error ||
                "This account has been banned by an administrator.",
            }),
          );
        } else {
          setError(result.error || "Something went wrong. Please try again.");
        }
        return;
      }

      if (signup && result.needsEmailConfirmation) {
        setMessage(
          "Account created. Please check your email to confirm your account, then log in.",
        );
        setPassword("");
        setConfirmPassword("");
        setTouched({});
        return;
      }

      router.push("/");
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    clearStatus();
    setGoogleLoading(true);

    try {
      const result = await continueWithGoogle();

      if (!result.success) {
        setError(result.error || "Google sign-in failed. Please try again.");
      }
    } catch (err) {
      setError(err?.message || "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  const submitDisabled = loading || googleLoading || !validation.isValid;

  return (
    <main className="auth-page page-section">
      <section className="auth-card reveal">
        <p className="eyebrow">{signup ? "Create account" : "Welcome back"}</p>
        <h1 className="gradient-text">{signup ? "Sign Up" : "Login"}</h1>
        <p>
          {signup
            ? "Create your CineMate account to save favourites, rate movies and receive personalised recommendations."
            : "Login to continue rating movies, saving favourites and viewing your personalised dashboard."}
        </p>

        <button
          type="button"
          className="google-auth-btn"
          onClick={handleGoogle}
          disabled={loading || googleLoading}
          aria-label="Continue with Google"
        >
          <span className="google-icon" aria-hidden="true">
            G
          </span>
          {googleLoading ? "Opening Google..." : "Continue with Google"}
        </button>

        <div className="auth-divider">
          <span>
            {signup ? "or sign up with email" : "or login with email"}
          </span>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          {signup && (
            <>
              <label htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                value={name}
                onChange={(e) => {
                  clearStatus();
                  setName(e.target.value);
                  markTouched("name");
                }}
                onBlur={() => markTouched("name")}
                placeholder="Enter your name"
                autoComplete="name"
                aria-invalid={Boolean(showFieldError("name"))}
                required
              />
              {showFieldError("name") && (
                <p className="auth-field-error">{validation.name}</p>
              )}
            </>
          )}

          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="text"
            inputMode="email"
            value={email}
            onChange={(e) => {
              clearStatus();
              setEmail(e.target.value);
              markTouched("email");
            }}
            onBlur={() => markTouched("email")}
            placeholder="Enter your email"
            autoComplete="email"
            aria-invalid={Boolean(showFieldError("email"))}
            required
          />
          {showFieldError("email") && (
            <p className="auth-field-error">{validation.email}</p>
          )}

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => {
              clearStatus();
              setPassword(e.target.value);
              markTouched("password");
              if (confirmPassword) markTouched("confirmPassword");
            }}
            onBlur={() => markTouched("password")}
            placeholder="Enter password"
            autoComplete={signup ? "new-password" : "current-password"}
            aria-invalid={Boolean(showFieldError("password"))}
            required
          />
          {showFieldError("password") && (
            <p className="auth-field-error">{validation.password}</p>
          )}

          {signup && (
            <>
              <label htmlFor="auth-confirm-password">Confirm Password</label>
              <input
                id="auth-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  clearStatus();
                  setConfirmPassword(e.target.value);
                  markTouched("confirmPassword");
                }}
                onBlur={() => markTouched("confirmPassword")}
                placeholder="Re-enter password"
                autoComplete="new-password"
                aria-invalid={Boolean(showFieldError("confirmPassword"))}
                required
              />
              {showFieldError("confirmPassword") && (
                <p className="auth-field-error">{validation.confirmPassword}</p>
              )}
            </>
          )}

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="auth-success" role="status">
              {message}
            </p>
          )}

          <button type="submit" disabled={submitDisabled}>
            {loading ? "Please wait..." : signup ? "Create Account" : "Login"}
          </button>
        </form>

        <p className="auth-switch">
          {signup ? "Already have an account?" : "No account yet?"}{" "}
          <Link href={signup ? "/login" : "/register"}>
            {signup ? "Login" : "Sign up"}
          </Link>
        </p>
      </section>
    </main>
  );
}
