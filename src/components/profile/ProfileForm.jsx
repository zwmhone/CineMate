"use client";

import { useEffect, useRef, useState } from "react";
import { getLooseEmailError, normaliseEmail } from "@/utils/emailValidation";
import {
  SECURITY_QUESTIONS,
  getSecurityQuestionByKey,
  isValidSecurityQuestionKey,
} from "@/constants/securityQuestions";

const MAX_IMAGE_SIZE = 420;

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Could not read the selected image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () =>
        reject(new Error("Could not load the selected image."));
      image.onload = () => {
        const ratio = Math.min(
          1,
          MAX_IMAGE_SIZE / Math.max(image.width, image.height),
        );
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function profileInitial(name = "", email = "") {
  return (
    String(name || email || "C")
      .trim()
      .charAt(0)
      .toUpperCase() || "C"
  );
}

function ActionButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`profile-account-action ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

const PASSWORD_RECOVERY_FLAG = "cinemate_password_recovery_active";

function hasRecoveryUrl() {
  if (typeof window === "undefined") return false;

  const searchParams = new URLSearchParams(window.location.search || "");
  const hashParams = new URLSearchParams(
    (window.location.hash || "").replace(/^#/, ""),
  );
  const hash = window.location.hash || "";

  return (
    searchParams.get("resetPassword") === "true" ||
    searchParams.get("type") === "recovery" ||
    hashParams.get("type") === "recovery" ||
    hash.includes("type=recovery") ||
    window.sessionStorage.getItem(PASSWORD_RECOVERY_FLAG) === "true"
  );
}

function activateRecoveryMode() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PASSWORD_RECOVERY_FLAG, "true");
}

function clearRecoveryMode() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG);
}

async function hashRecoveryAnswer(answer = "", questionKey = "") {
  const cleanAnswer = String(answer || "")
    .trim()
    .toLowerCase();
  const cleanQuestionKey = String(questionKey || "").trim();
  if (!cleanAnswer) return "";

  const hashInput = cleanQuestionKey
    ? `${cleanQuestionKey}:${cleanAnswer}`
    : cleanAnswer;

  const encoder = new TextEncoder();
  const buffer = await window.crypto.subtle.digest(
    "SHA-256",
    encoder.encode(hashInput),
  );

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  visible,
  onToggle,
}) {
  return (
    <div className="profile-password-field">
      <label htmlFor={id}>{label}</label>
      <div className="profile-password-input-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <button
          type="button"
          className="profile-eye-btn"
          onClick={onToggle}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function SecurityQuestionPicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const selectedQuestion = getSecurityQuestionByKey(value);

  function chooseQuestion(questionKey) {
    onChange(questionKey);
    setOpen(false);
  }

  return (
    <div className="profile-question-picker">
      <button
        type="button"
        className={`profile-question-trigger ${open ? "open" : ""}`.trim()}
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selectedQuestion.label}</span>
        <span className="profile-question-arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="profile-question-menu" role="listbox">
          {SECURITY_QUESTIONS.map((question) => (
            <button
              key={question.key}
              type="button"
              role="option"
              aria-selected={question.key === value}
              className={
                question.key === value
                  ? "profile-question-option selected"
                  : "profile-question-option"
              }
              onClick={() => chooseQuestion(question.key)}
            >
              {question.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ProfileForm({
  profile,
  saving,
  onSave,
  onResetPassword,
  onLogout,
  onDeleteAccount,
  onClearStatus,
}) {
  const fileRef = useRef(null);
  const [mode, setMode] = useState("view");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [securityQuestionKey, setSecurityQuestionKey] = useState(
    SECURITY_QUESTIONS[0].key,
  );
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [securityConfirmAnswer, setSecurityConfirmAnswer] = useState("");
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [localError, setLocalError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasPassword = profile?.hasPassword !== false;
  const authProviders = Array.isArray(profile?.authProviders)
    ? profile.authProviders
    : [];
  const hasGoogleProvider = authProviders.includes("google");
  const recoveryQuestionReady = Boolean(profile?.recoveryQuestionReady);
  const recoveryQuestionKey =
    profile?.recoveryQuestionKey || SECURITY_QUESTIONS[0].key;
  const recoveryQuestionItem = getSecurityQuestionByKey(recoveryQuestionKey);
  const recoveryQuestion =
    profile?.recoveryQuestion || recoveryQuestionItem.label;
  const needsPasswordConfirmation = hasPassword;
  const passwordActionLabel = hasPassword ? "Change Password" : "Set Password";
  const isRecoveryMode = mode === "recoveryPassword";

  useEffect(() => {
    const recoveryActive = hasRecoveryUrl();

    setFullName(profile?.fullName || "");
    setEmail(profile?.email || "");
    setProfileImage(profile?.profileImage || null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setRecoveryAnswer("");
    setSecurityQuestionKey(
      profile?.recoveryQuestionKey || SECURITY_QUESTIONS[0].key,
    );
    setSecurityAnswer("");
    setSecurityConfirmAnswer("");
    setRecoveryVerified(false);
    setDeleteText("");
    setLocalError("");

    if (recoveryActive) {
      activateRecoveryMode();
      setMode("recoveryPassword");
    } else {
      setMode("view");
    }
  }, [
    profile?.userId,
    profile?.fullName,
    profile?.email,
    profile?.profileImage,
    profile?.recoveryQuestionKey,
  ]);

  useEffect(() => {
    if (!hasRecoveryUrl()) return;

    activateRecoveryMode();
    setMode("recoveryPassword");
    setLocalError("");
    onClearStatus?.();

    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?resetPassword=true`,
      );
    }
  }, [onClearStatus]);

  function resetFormState(nextMode = "view") {
    if (nextMode !== "recoveryPassword") {
      clearRecoveryMode();
      if (
        typeof window !== "undefined" &&
        window.location.search.includes("resetPassword")
      ) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    setFullName(profile?.fullName || "");
    setEmail(profile?.email || "");
    setProfileImage(profile?.profileImage || null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setRecoveryAnswer("");
    setSecurityQuestionKey(
      profile?.recoveryQuestionKey || SECURITY_QUESTIONS[0].key,
    );
    setSecurityAnswer("");
    setSecurityConfirmAnswer("");
    setRecoveryVerified(false);
    setDeleteText("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setLocalError("");
    onClearStatus?.();
    setMode(nextMode);
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalError("");
    onClearStatus?.();

    try {
      const resized = await resizeImage(file);
      setProfileImage(resized);
    } catch (imageError) {
      setLocalError(imageError.message || "Could not use that image.");
    } finally {
      event.target.value = "";
    }
  }

  async function saveIdentity(event) {
    event.preventDefault();
    setLocalError("");
    onClearStatus?.();

    const cleanName = fullName.trim();
    if (cleanName.length < 2) {
      setLocalError("Please enter a display name with at least 2 characters.");
      return;
    }

    const result = await onSave?.({
      fullName: cleanName,
      email: profile?.email || email,
      profileImage,
      currentPassword: "",
      newPassword: "",
      requiresCurrentPassword: false,
      updateEmail: false,
    });

    if (result?.success) resetFormState("view");
  }

  async function saveEmail(event) {
    event.preventDefault();
    setLocalError("");
    onClearStatus?.();

    const cleanEmail = normaliseEmail(email);
    const currentEmail = normaliseEmail(profile?.email || "");
    const emailError = getLooseEmailError(cleanEmail);

    if (emailError) {
      setLocalError(emailError);
      return;
    }

    if (cleanEmail === currentEmail) {
      setLocalError("Enter a different email address before saving.");
      return;
    }

    const emailNeedsCurrentPassword = hasPassword;

    if (emailNeedsCurrentPassword && !currentPassword) {
      setLocalError("Please enter your current password to change your email.");
      return;
    }

    const result = await onSave?.({
      fullName: profile?.fullName || fullName,
      email: cleanEmail,
      profileImage: profile?.profileImage || null,
      currentPassword,
      newPassword: "",
      requiresCurrentPassword: emailNeedsCurrentPassword,
      updateEmail: true,
    });

    if (result?.success) resetFormState("view");
  }

  async function savePassword(event) {
    event.preventDefault();
    setLocalError("");
    onClearStatus?.();

    if (isRecoveryMode && recoveryQuestionReady && !recoveryVerified) {
      setLocalError(
        "Please answer your security question before setting a new password.",
      );
      setMode("recoveryVerify");
      return;
    }

    const needsCurrentPassword = needsPasswordConfirmation && !isRecoveryMode;

    if (needsCurrentPassword && !currentPassword) {
      setLocalError("Please enter your current password.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setLocalError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError("New password and confirm password do not match.");
      return;
    }

    const result = await onSave?.({
      fullName: profile?.fullName || fullName,
      email: profile?.email || email,
      profileImage: profile?.profileImage || null,
      currentPassword,
      newPassword,
      requiresCurrentPassword: needsCurrentPassword,
      recoveryMode: isRecoveryMode,
      updateEmail: false,
    });

    if (result?.success) {
      clearRecoveryMode();
      resetFormState("view");
    }
  }

  async function handleResetPassword() {
    setLocalError("");
    onClearStatus?.();
    const cleanEmail = normaliseEmail(profile?.email || email || "");
    const emailError = getLooseEmailError(cleanEmail);

    if (emailError) {
      setLocalError("Please enter a valid email address first.");
      return;
    }

    if (!recoveryQuestionReady) {
      setLocalError(
        "Please set your security question first before using Forgot Password from profile.",
      );
      setMode("security");
      return;
    }

    setRecoveryVerified(false);
    setRecoveryAnswer("");
    setMode("recoveryVerify");
  }

  async function saveSecurityQuestion(event) {
    event.preventDefault();
    setLocalError("");
    onClearStatus?.();

    const answer = securityAnswer.trim();
    const confirmAnswer = securityConfirmAnswer.trim();

    if (hasPassword && !currentPassword) {
      setLocalError(
        "Please enter your current password to update your security question.",
      );
      return;
    }

    if (!isValidSecurityQuestionKey(securityQuestionKey)) {
      setLocalError("Please choose a valid security question.");
      return;
    }

    if (answer.length < 2) {
      setLocalError("Please enter your security answer.");
      return;
    }

    if (answer.toLowerCase() !== confirmAnswer.toLowerCase()) {
      setLocalError("Security answer and confirm answer do not match.");
      return;
    }

    const answerHash = await hashRecoveryAnswer(answer, securityQuestionKey);
    const result = await onSave?.({
      fullName: profile?.fullName || fullName,
      email: profile?.email || email,
      profileImage: profile?.profileImage || null,
      currentPassword,
      newPassword: "",
      requiresCurrentPassword: hasPassword,
      updateEmail: false,
      updateRecoveryQuestion: true,
      recoveryQuestionKey: securityQuestionKey,
      recoveryAnswerHash: answerHash,
    });

    if (result?.success) resetFormState("view");
  }

  async function verifyRecoveryAnswer(event) {
    event.preventDefault();
    setLocalError("");
    onClearStatus?.();

    const answerHash = await hashRecoveryAnswer(
      recoveryAnswer,
      recoveryQuestionKey,
    );
    const legacyAnswerHash = await hashRecoveryAnswer(recoveryAnswer);
    if (
      !answerHash ||
      (answerHash !== profile?.recoveryAnswerHash &&
        legacyAnswerHash !== profile?.recoveryAnswerHash)
    ) {
      setLocalError(
        "Security answer is incorrect. Please check it and try again.",
      );
      return;
    }

    activateRecoveryMode();
    setRecoveryVerified(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMode("recoveryPassword");
  }

  async function handleDeleteAccount(event) {
    event.preventDefault();
    setLocalError("");
    onClearStatus?.();

    if (deleteText.trim().toUpperCase() !== "DELETE") {
      setLocalError("Type DELETE to confirm account deletion.");
      return;
    }

    if (hasPassword && !currentPassword) {
      setLocalError(
        "Please enter your current password to delete your account.",
      );
      return;
    }

    const result = await onDeleteAccount?.({
      currentPassword,
      requiresCurrentPassword: hasPassword,
    });

    if (!result?.success && result?.error) setLocalError(result.error);
  }

  const avatar = profileImage ? (
    <img alt="Profile" src={profileImage} />
  ) : (
    <span>{profileInitial(fullName, email)}</span>
  );

  return (
    <section className="profile-page-form glass-panel">
      <div className="profile-account-hero">
        <div
          className="profile-page-avatar large"
          aria-label="Profile image preview"
        >
          {profile?.profileImage ? (
            <img alt="Profile" src={profile.profileImage} />
          ) : (
            <span>{profileInitial(profile?.fullName, profile?.email)}</span>
          )}
        </div>
        <div className="profile-account-copy">
          <p className="eyebrow">Account Details</p>
          <h3>{profile?.fullName || "CineMate User"}</h3>
          <p>{profile?.email}</p>
          {profile?.authProviders?.length ? (
            <small>Signed in with {profile.authProviders.join(", ")}</small>
          ) : null}
        </div>
      </div>

      {mode === "view" ? (
        <div className="profile-account-view">
          <div className="profile-account-row flat">
            <span>Display name</span>
            <strong>{profile?.fullName || "Not set"}</strong>
            <small>Shown beside your comments and reviews.</small>
          </div>
          <div className="profile-account-row flat">
            <span>Email</span>
            <strong>{profile?.email || "Not set"}</strong>
            <small>Used for login and account updates.</small>
          </div>
          <div className="profile-account-row flat">
            <span>Password</span>
            <strong>{hasPassword ? "••••••••" : "Not set yet"}</strong>
            <small>
              {hasPassword
                ? "Change it securely using your current password."
                : hasGoogleProvider
                  ? "Google sign-in is active. You can set a CineMate password too."
                  : "Set a CineMate password for email login."}
            </small>
          </div>
          <div className="profile-account-row flat">
            <span>Security question</span>
            <strong>{recoveryQuestionReady ? "Set" : "Not set"}</strong>
            <small>
              {recoveryQuestionReady
                ? "Security check is ready for Forgot Password."
                : "Please add a security question before using Forgot Password."}
            </small>
          </div>

          {!recoveryQuestionReady ? (
            <div className="profile-security-reminder" role="note">
              <strong>Please add security question</strong>
              <span>
                This protects the Forgot Password feature and must be set before
                password recovery can be used from your profile.
              </span>
            </div>
          ) : null}

          <div className="profile-action-grid modern">
            <ActionButton
              className="primary"
              onClick={() => resetFormState("identity")}
            >
              Edit Profile
            </ActionButton>
            <ActionButton onClick={() => resetFormState("email")}>
              Change Email
            </ActionButton>
            <ActionButton onClick={() => resetFormState("password")}>
              {passwordActionLabel}
            </ActionButton>
            {!recoveryQuestionReady ? (
              <ActionButton onClick={() => resetFormState("security")}>
                Security Question
              </ActionButton>
            ) : (
              <ActionButton disabled={saving} onClick={handleResetPassword}>
                Forgot Password
              </ActionButton>
            )}
            <ActionButton
              className="logout"
              disabled={saving}
              onClick={onLogout}
            >
              Logout
            </ActionButton>
            <ActionButton
              className="danger"
              onClick={() => resetFormState("delete")}
            >
              Delete Account
            </ActionButton>
          </div>

          <div className="profile-account-links">
            <button
              type="button"
              className="profile-account-text-link"
              onClick={() => resetFormState("security")}
            >
              {recoveryQuestionReady
                ? "Change security question"
                : "Set security question"}
            </button>
          </div>
        </div>
      ) : null}

      {mode === "identity" ? (
        <form className="profile-edit-panel clean" onSubmit={saveIdentity}>
          <div className="profile-mode-header">
            <div>
              <h3>Edit Profile</h3>
              <p>
                Change your display name and profile image. No password is
                needed for this section.
              </p>
            </div>
            <button
              type="button"
              className="profile-soft-btn small"
              onClick={() => resetFormState("view")}
            >
              Cancel
            </button>
          </div>

          <div className="profile-picture-editor clean">
            <div
              className="profile-page-avatar"
              aria-label="Profile image preview"
            >
              {avatar}
            </div>
            <div>
              <div className="profile-inline-actions">
                <button
                  type="button"
                  className="profile-theme-btn"
                  onClick={() => fileRef.current?.click()}
                >
                  Change Picture
                </button>
                <button
                  type="button"
                  className="profile-soft-btn"
                  onClick={() => setProfileImage(null)}
                >
                  Remove
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageChange}
              />
              <p>
                Images are uploaded to Supabase Storage and shown beside your
                reviews.
              </p>
            </div>
          </div>

          <label htmlFor="profile-name">Display name</label>
          <input
            id="profile-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your name"
            maxLength={80}
          />

          {localError ? (
            <p className="profile-error inline" role="alert">
              {localError}
            </p>
          ) : null}
          <button type="submit" className="profile-save-main" disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      ) : null}

      {mode === "email" ? (
        <form className="profile-edit-panel clean" onSubmit={saveEmail}>
          <div className="profile-mode-header">
            <div>
              <h3>Change Email</h3>
              <p>
                Enter a new email. If this account already has a CineMate
                password, confirm it with your current password.
              </p>
            </div>
            <button
              type="button"
              className="profile-soft-btn small"
              onClick={() => resetFormState("view")}
            >
              Cancel
            </button>
          </div>

          {!hasPassword ? (
            <p className="profile-warning">
              This account does not have a CineMate password yet, so your active
              logged-in session will be used to confirm this email change.
            </p>
          ) : null}

          <label htmlFor="profile-email">New email</label>
          <input
            id="profile-email"
            type="text"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />

          <PasswordField
            id="profile-current-password-email"
            label="Current password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Required to change email"
            autoComplete="current-password"
            disabled={!hasPassword}
            visible={showCurrentPassword}
            onToggle={() => setShowCurrentPassword((value) => !value)}
          />

          {localError ? (
            <p className="profile-error inline" role="alert">
              {localError}
            </p>
          ) : null}
          <button type="submit" className="profile-save-main" disabled={saving}>
            {saving ? "Saving..." : "Save Email"}
          </button>
        </form>
      ) : null}

      {mode === "security" ? (
        <form
          className="profile-edit-panel clean"
          onSubmit={saveSecurityQuestion}
        >
          <div className="profile-mode-header">
            <div>
              <h3>
                {recoveryQuestionReady
                  ? "Change Security Question"
                  : "Set Security Question"}
              </h3>
              <p>
                Choose a question and answer that only you can remember. This
                protects the Forgot Password feature inside your profile.
              </p>
            </div>
            <button
              type="button"
              className="profile-soft-btn small"
              onClick={() => resetFormState("view")}
            >
              Cancel
            </button>
          </div>

          {hasPassword ? (
            <PasswordField
              id="profile-security-current-password"
              label="Current password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Required to update security question"
              autoComplete="current-password"
              visible={showCurrentPassword}
              onToggle={() => setShowCurrentPassword((value) => !value)}
            />
          ) : null}

          <label htmlFor="profile-security-question">Question</label>
          <SecurityQuestionPicker
            value={securityQuestionKey}
            onChange={setSecurityQuestionKey}
            disabled={saving}
          />

          <PasswordField
            id="profile-security-answer"
            label="Answer"
            value={securityAnswer}
            onChange={(event) => setSecurityAnswer(event.target.value)}
            placeholder={
              getSecurityQuestionByKey(securityQuestionKey).placeholder
            }
            autoComplete="off"
            visible={showNewPassword}
            onToggle={() => setShowNewPassword((value) => !value)}
          />

          <PasswordField
            id="profile-security-answer-confirm"
            label="Confirm answer"
            value={securityConfirmAnswer}
            onChange={(event) => setSecurityConfirmAnswer(event.target.value)}
            placeholder="Repeat your answer"
            autoComplete="off"
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
          />

          {localError ? (
            <p className="profile-error inline" role="alert">
              {localError}
            </p>
          ) : null}
          <button type="submit" className="profile-save-main" disabled={saving}>
            {saving
              ? "Saving..."
              : recoveryQuestionReady
                ? "Update Security Question"
                : "Save Security Question"}
          </button>
        </form>
      ) : null}

      {mode === "recoveryVerify" ? (
        <form
          className="profile-edit-panel clean"
          onSubmit={verifyRecoveryAnswer}
        >
          <div className="profile-mode-header">
            <div>
              <h3>Security Check</h3>
              <p>
                Answer your security question before setting a new password.
              </p>
            </div>
            <button
              type="button"
              className="profile-soft-btn small"
              onClick={() => resetFormState("view")}
            >
              Cancel
            </button>
          </div>

          <label htmlFor="profile-recovery-question">Question</label>
          <input
            id="profile-recovery-question"
            type="text"
            value={recoveryQuestion}
            disabled
            readOnly
          />

          <PasswordField
            id="profile-recovery-answer"
            label="Answer"
            value={recoveryAnswer}
            onChange={(event) => setRecoveryAnswer(event.target.value)}
            placeholder={recoveryQuestionItem.placeholder}
            autoComplete="off"
            visible={showCurrentPassword}
            onToggle={() => setShowCurrentPassword((value) => !value)}
          />

          {localError ? (
            <p className="profile-error inline" role="alert">
              {localError}
            </p>
          ) : null}
          <button type="submit" className="profile-save-main" disabled={saving}>
            Continue
          </button>
        </form>
      ) : null}

      {mode === "password" || mode === "recoveryPassword" ? (
        <form className="profile-edit-panel clean" onSubmit={savePassword}>
          <div className="profile-mode-header">
            <div>
              <h3>
                {isRecoveryMode ? "Set New Password" : passwordActionLabel}
              </h3>
              <p>
                {isRecoveryMode
                  ? "Security question verified. Choose a new password for your CineMate account."
                  : hasPassword
                    ? "Confirm your current password, then choose a new password."
                    : "Create a password so you can also sign in with email and password."}
              </p>
            </div>
            <button
              type="button"
              className="profile-soft-btn small"
              onClick={() => resetFormState("view")}
            >
              Cancel
            </button>
          </div>

          {needsPasswordConfirmation && !isRecoveryMode ? (
            <PasswordField
              id="profile-current-password"
              label="Current password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
              visible={showCurrentPassword}
              onToggle={() => setShowCurrentPassword((value) => !value)}
            />
          ) : null}

          {hasGoogleProvider && !hasPassword && !isRecoveryMode ? (
            <p className="profile-warning">
              This account uses Google sign-in. You can set a CineMate password
              here if you also want email/password login.
            </p>
          ) : null}

          <PasswordField
            id="profile-new-password"
            label={isRecoveryMode ? "Set new password" : "New password"}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            visible={showNewPassword}
            onToggle={() => setShowNewPassword((value) => !value)}
          />

          <PasswordField
            id="profile-confirm-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat new password"
            autoComplete="new-password"
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
          />

          {!isRecoveryMode && recoveryQuestionReady ? (
            <button
              type="button"
              className="profile-reset-link inline"
              disabled={saving}
              onClick={handleResetPassword}
            >
              Forgot password? Answer your security question
            </button>
          ) : null}

          {localError ? (
            <p className="profile-error inline" role="alert">
              {localError}
            </p>
          ) : null}
          <button type="submit" className="profile-save-main" disabled={saving}>
            {saving
              ? "Saving..."
              : isRecoveryMode
                ? "Set New Password"
                : passwordActionLabel}
          </button>
        </form>
      ) : null}

      {mode === "delete" ? (
        <form
          className="profile-edit-panel clean danger-panel"
          onSubmit={handleDeleteAccount}
        >
          <div className="profile-mode-header">
            <div>
              <h3>Delete Account</h3>
              <p>
                This removes your CineMate profile data, favourites, ratings,
                comments, watch status and recommendation feedback, then logs
                you out.
              </p>
            </div>
            <button
              type="button"
              className="profile-soft-btn small"
              onClick={() => resetFormState("view")}
            >
              Cancel
            </button>
          </div>

          {hasPassword ? (
            <PasswordField
              id="profile-delete-password"
              label="Current password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Required to delete account data"
              autoComplete="current-password"
              visible={showCurrentPassword}
              onToggle={() => setShowCurrentPassword((value) => !value)}
            />
          ) : null}

          <label htmlFor="profile-delete-confirm">Type DELETE to confirm</label>
          <input
            id="profile-delete-confirm"
            type="text"
            value={deleteText}
            onChange={(event) => setDeleteText(event.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />

          {localError ? (
            <p className="profile-error inline" role="alert">
              {localError}
            </p>
          ) : null}
          <button
            type="submit"
            className="profile-delete-btn"
            disabled={saving}
          >
            {saving ? "Deleting..." : "Delete Account Data"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
