import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { digest, isCareRole, serverToken, type CareRole } from "./care-access";
import { createSupabaseClient } from "./supabase";

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const dummyHash = "0".repeat(32) + "." + "0".repeat(128);
export const accountUuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
export const inviteFormat = /^[A-Za-z0-9_-]{43}$/;

interface AccountIdentity { id: string; profile_id: string; role: CareRole }
export interface AccountRoster {
  can_invite: boolean;
  members: Array<{ id: string; role: CareRole; verified: boolean }>;
}

export function accountIdentity(value: unknown): AccountIdentity | null {
  if (!value || typeof value !== "object") return null;
  const { id, profile_id, role } = value as Partial<AccountIdentity>;
  return typeof id === "string" && accountUuid.test(id) &&
    typeof profile_id === "string" && accountUuid.test(profile_id) && isCareRole(role)
    ? { id, profile_id, role } : null;
}

export function emailFormat(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function inviteToken() {
  return randomBytes(32).toString("base64url");
}

export function inviteHash(token: string) {
  return digest("account-invite", token);
}

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, result) => error ? reject(error) : resolve(result));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hashed = await derivePassword(password, salt);
  return salt.toString("hex") + "." + hashed.toString("hex");
}

export async function passwordMatches(password: string, stored: unknown) {
  const valid = typeof stored === "string" && /^[a-f0-9]{32}\.[a-f0-9]{128}$/.test(stored);
  const [salt, expected] = (valid ? stored : dummyHash).split(".");
  const actual = await derivePassword(password, Buffer.from(salt, "hex"));
  return timingSafeEqual(actual, Buffer.from(expected, "hex")) && valid;
}

export async function accountRoster(profileId: string, accountId: string): Promise<AccountRoster | null> {
  const { data, error } = await createSupabaseClient().rpc("carecircle_account_roster", {
    p_token: serverToken(), p_profile_id: profileId, p_account_id: accountId,
  });
  return !error && data && Array.isArray(data.members) ? data : null;
}
