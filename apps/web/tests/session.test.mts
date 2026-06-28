import assert from "node:assert/strict";
import test from "node:test";

import {
  authConfigured,
  createSessionCookie,
  sanitizeNextPath,
  verifyPassword,
  verifySessionCookie
} from "../lib/session.ts";

test.beforeEach(() => {
  delete process.env.UOCC_WEB_AUTH_DISABLED;
  delete process.env.UOCC_WEB_LOGIN_PASSWORD;
  delete process.env.UOCC_WEB_SESSION_SECRET;
  delete process.env.UOCC_OPERATOR_TOKEN;
});

test("session cookie verifies only when signed and unexpired", async () => {
  process.env.UOCC_WEB_LOGIN_PASSWORD = "correct-password";
  process.env.UOCC_WEB_SESSION_SECRET = "session-secret";

  const now = 1_700_000_000_000;
  const cookie = await createSessionCookie(now);

  assert.equal(authConfigured(), true);
  assert.equal(await verifyPassword("correct-password"), true);
  assert.equal(await verifyPassword("wrong-password"), false);
  assert.equal(await verifySessionCookie(cookie, now + 1000), true);
  assert.equal(await verifySessionCookie(`${cookie}tampered`, now + 1000), false);
  assert.equal(await verifySessionCookie(cookie, now + 60 * 60 * 13 * 1000), false);
});

test("auth is enabled from operator token unless explicitly disabled", async () => {
  process.env.UOCC_OPERATOR_TOKEN = "operator-token";
  assert.equal(authConfigured(), true);

  process.env.UOCC_WEB_AUTH_DISABLED = "true";
  assert.equal(authConfigured(), false);
  assert.equal(await verifySessionCookie(undefined), true);
});

test("next path sanitization keeps redirects local", () => {
  assert.equal(sanitizeNextPath("/systemd?unit=ssh"), "/systemd?unit=ssh");
  assert.equal(sanitizeNextPath("https://example.com"), "/");
  assert.equal(sanitizeNextPath("//example.com"), "/");
  assert.equal(sanitizeNextPath("/auth/logout"), "/");
});
