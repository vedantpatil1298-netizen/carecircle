import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { uuidPattern } from "./form-values";

export const careRoles = ["elder", "caretaker", "family"] as const;
export type CareRole = (typeof careRoles)[number];

export const roleLabels: Record<CareRole, string> = {
  elder: "Older adult",
  caretaker: "Caretaker",
  family: "Family member",
};

const cookieName = "carecircle_session";
const lifetimeSeconds = 60 * 60 * 8;
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

type CareSession = { profileId: string; role: CareRole; expiresAt: number; accountId?: string };

export function serverToken() {
  const token = process.env.CARECIRCLE_SERVER_TOKEN;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    throw new Error("CareCircle server credential is missing.");
  }
  return token;
}

export function digest(purpose: string, value: string) {
  return createHmac("sha256", serverToken()).update(purpose).update(":").update(value).digest("hex");
}

export async function clientHash() {
  const incoming = await headers();
  const address = (incoming.get("x-vercel-forwarded-for") ?? "local").split(",")[0].trim();
  return digest("client", address);
}

export function normalizePasscode(code: string) {
  return code.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

export function validPasscode(code: string) {
  return code.length === 16 && [...code].every((character) => alphabet.includes(character));
}

export function passcodeHash(code: string) {
  return digest("passcode", normalizePasscode(code));
}

export function isCareRole(value: unknown): value is CareRole {
  return typeof value === "string" && careRoles.some((role) => role === value);
}

export async function setCareSession(profileId: string, role: CareRole, accountId?: string) {
  const session: CareSession = { profileId, role, accountId, expiresAt: Date.now() + lifetimeSeconds * 1000 };
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  const store = await cookies();
  store.set(cookieName, `${body}.${digest("session", body)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: lifetimeSeconds,
    path: "/",
  });
}

export async function getCareSession(): Promise<CareSession | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value || value.length > 512) return null;

  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra !== undefined || !/^[0-9a-f]{64}$/.test(signature)) return null;

  try {
    const expected = Buffer.from(digest("session", body), "hex");
    if (!timingSafeEqual(Buffer.from(signature, "hex"), expected)) return null;

    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (
      !parsed || typeof parsed.profileId !== "string" ||
      !uuidPattern.test(parsed.profileId) || !isCareRole(parsed.role) ||
      !Number.isSafeInteger(parsed.expiresAt) || parsed.expiresAt <= Date.now() ||
      (parsed.accountId !== undefined && (typeof parsed.accountId !== "string" || !uuidPattern.test(parsed.accountId)))
    ) return null;

    return parsed;
  } catch {
    return null;
  }
}

export async function clearCareSession() {
  (await cookies()).delete(cookieName);
}
