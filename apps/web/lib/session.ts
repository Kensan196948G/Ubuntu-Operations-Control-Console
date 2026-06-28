export const SESSION_COOKIE = "uocc_session";
export const SESSION_TTL_SECONDS = Number(process.env.UOCC_SESSION_TTL_SECONDS ?? 60 * 60 * 12);

const TRUE_VALUES = new Set(["1", "true", "yes"]);
const DISABLE_VALUES = new Set(["1", "true", "yes"]);

export function loginPassword() {
  return process.env.UOCC_WEB_LOGIN_PASSWORD || process.env.UOCC_OPERATOR_TOKEN || "";
}

export function sessionSecret() {
  return process.env.UOCC_WEB_SESSION_SECRET || loginPassword();
}

export function authConfigured() {
  if (DISABLE_VALUES.has((process.env.UOCC_WEB_AUTH_DISABLED ?? "").toLowerCase())) {
    return false;
  }
  return Boolean(loginPassword() && sessionSecret());
}

export function cookieSecure() {
  return TRUE_VALUES.has((process.env.UOCC_SESSION_COOKIE_SECURE ?? "").toLowerCase());
}

export async function verifyPassword(candidate: string) {
  const expected = loginPassword();
  return Boolean(expected) && candidate === expected;
}

export async function createSessionCookie(now = Date.now()) {
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  const payload = `v1.${expiresAt}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionCookie(value: string | undefined, now = Date.now()) {
  if (!authConfigured()) {
    return true;
  }
  if (!value) {
    return false;
  }

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return false;
  }

  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return false;
  }

  const payload = `${parts[0]}.${parts[1]}`;
  return `${payload}.${await sign(payload)}` === value;
}

export function sanitizeNextPath(value: FormDataEntryValue | string | null | undefined) {
  const path = typeof value === "string" ? value : "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/auth/")) {
    return "/";
  }
  return path;
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64Url(new Uint8Array(signature));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
