export function normaliseEmail(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function isLooseEmail(value = "") {
  const email = normaliseEmail(value);
  const atIndex = email.indexOf("@");
  const domain = atIndex >= 0 ? email.slice(atIndex + 1) : "";

  return Boolean(
    email &&
    !/\s/.test(email) &&
    atIndex > 0 &&
    atIndex === email.lastIndexOf("@") &&
    domain.includes(".") &&
    !domain.startsWith(".") &&
    !domain.endsWith("."),
  );
}

export function getLooseEmailError(value = "") {
  const email = normaliseEmail(value);

  if (!email) return "Email is required.";
  if (/\s/.test(email)) return "Email must not contain spaces.";
  if (!email.includes("@")) return "Email must include @.";
  if (email.indexOf("@") !== email.lastIndexOf("@"))
    return "Email can only include one @ symbol.";
  if (!email.split("@")[1]?.includes("."))
    return "Email domain must include a dot, for example .com.";
  if (!isLooseEmail(email)) return "Please enter a valid email address.";

  return "";
}
