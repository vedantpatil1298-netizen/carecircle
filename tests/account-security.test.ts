import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { store } = vi.hoisted(() => ({ store: { get: vi.fn(), set: vi.fn(), delete: vi.fn() } }));
vi.mock("next/headers", () => ({ cookies: async () => store }));

import { accountIdentity, hashPassword, inviteFormat, inviteHash, inviteToken, passwordMatches } from "../lib/account-security";
import { clearCareSession, digest, getCareSession, normalizePasscode, passcodeHash, setCareSession, validPasscode } from "../lib/care-access";

const profileId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const accountId = "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CARECIRCLE_SERVER_TOKEN", "ab".repeat(32));
  store.get.mockReturnValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("account credentials", () => {
  it("salts passwords and only accepts the original password", async () => {
    const password = "fictional test password";
    const [first, second] = await Promise.all([hashPassword(password), hashPassword(password)]);
    expect(first).toMatch(/^[a-f0-9]{32}\.[a-f0-9]{128}$/);
    expect(second).not.toBe(first);
    await expect(passwordMatches(password, first)).resolves.toBe(true);
    await expect(passwordMatches(password + "!", first)).resolves.toBe(false);
    await expect(passwordMatches(password, undefined)).resolves.toBe(false);
  });

  it("uses separate, expiring-link-compatible secrets", () => {
    const token = inviteToken();
    expect(inviteFormat.test(token)).toBe(true);
    expect(inviteToken()).not.toBe(token);
    expect(inviteHash(token)).not.toBe(digest("session", token));
    expect(accountIdentity({ id: accountId, profile_id: profileId, role: "admin" })).toBeNull();
  });

  it("normalizes legacy passcodes before validation and hashing", () => {
    const canonical = normalizePasscode(" oiL9 - abcd-efgh-jkmn ");
    expect(canonical).toBe("0119ABCDEFGHJKMN");
    expect(validPasscode(canonical)).toBe(true);
    expect(validPasscode("U" + canonical.slice(1))).toBe(false);
    expect(passcodeHash(canonical)).toBe(passcodeHash("OIL9-ABCD-EFGH-JKMN"));
  });
});

describe("session cookie", () => {
  it("round-trips the scoped account and sets browser security flags", async () => {
    await setCareSession(profileId, "family", accountId);
    const [name, value, options] = store.set.mock.calls[0];
    expect(name).toBe("carecircle_session");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 28_800 });
    store.get.mockReturnValue({ value });
    await expect(getCareSession()).resolves.toMatchObject({ profileId, role: "family", accountId });
    await clearCareSession();
    expect(store.delete).toHaveBeenCalledWith(name);
  });

  it("rejects a forged role, an expired signature, and overlong cookies", async () => {
    const valid = Buffer.from(JSON.stringify({ profileId, role: "family", expiresAt: Date.now() + 1000 })).toString("base64url");
    const forged = Buffer.from(JSON.stringify({ profileId, role: "elder", expiresAt: Date.now() + 1000 })).toString("base64url");
    const expired = Buffer.from(JSON.stringify({ profileId, role: "family", expiresAt: Date.now() - 1000 })).toString("base64url");
    for (const value of [
      `${forged}.${digest("session", valid)}`,
      `${expired}.${digest("session", expired)}`,
      "x".repeat(513),
    ]) {
      store.get.mockReturnValue({ value });
      await expect(getCareSession()).resolves.toBeNull();
    }
  });
});
