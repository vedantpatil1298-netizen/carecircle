"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  clearCareSession, clientHash, digest, getCareSession, isCareRole,
  normalizePasscode, passcodeHash, serverToken, setCareSession, validPasscode,
} from "../lib/care-access";
import { accountIdentity, accountUuid, emailFormat, hashPassword, inviteFormat, inviteHash, inviteToken, passwordMatches } from "../lib/account-security";
import { sendVerification, verificationAvailable } from "../lib/verification-email";
import { createSupabaseClient } from "../lib/supabase";

type AccessState = { error?: string; success?: string };
const genders = ["woman", "man", "non-binary", "self-described", "prefer-not-to-say"];
const invalidSignIn = "That email and password didn’t match.";

function field(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function text(form: FormData, key: string) {
  return field(form, key).trim();
}

export async function createProfile(_previous: AccessState, form: FormData): Promise<AccessState> {
  const name = text(form, "elderName");
  const age = Number(text(form, "age"));
  const gender = text(form, "gender");
  const ownerRole = text(form, "ownerRole");
  const emails = {
    elder: text(form, "elderEmail").toLowerCase(),
    caretaker: text(form, "caretakerEmail").toLowerCase(),
    family: text(form, "familyEmail").toLowerCase(),
  };
  if (!name || name.length > 80 || !Number.isInteger(age) || age < 1 || age > 120 || !genders.includes(gender)) {
    return { error: "Enter the older adult’s name, age and gender preference." };
  }
  if (ownerRole !== "caretaker" && ownerRole !== "family") return { error: "Choose who will set up the first password." };
  const recipient = emails[ownerRole];
  if (!emailFormat(recipient) || Object.values(emails).some((email) => email && !emailFormat(email))) {
    return { error: "Enter a valid email for the person setting up the account." };
  }
  const enteredEmails = Object.values(emails).filter(Boolean);
  if (new Set(enteredEmails).size !== enteredEmails.length) {
    return { error: "Use a different email for each member so each role can sign in securely." };
  }
  if (!verificationAvailable()) return { error: "Email verification is temporarily unavailable. If you already have a profile, you can still sign in." };

  try {
    const token = inviteToken();
    const { error } = await createSupabaseClient().rpc("carecircle_start_enrollment", {
      p_token: serverToken(), p_client: await clientHash(), p_address_hash: digest("enrollment-email", recipient),
      p_hash: inviteHash(token), p_details: { name, age, gender, emails, owner_role: ownerRole },
    });
    if (error?.code === "P0001") return { error: "Too many setup requests. Wait a while and try again." };
    if (!error && await sendVerification(recipient, token)) {
      return { success: "Check the chosen inbox for a verification link. That person can set the first password after opening it." };
    }
  } catch {
    // Keep provider errors and enrollment details on the server.
  }
  return { error: "We couldn’t send the verification email. Check the address and try again." };
}

export async function verifyAccount(_previous: AccessState, form: FormData): Promise<AccessState> {
  const token = text(form, "token");
  const password = field(form, "password");
  const confirmation = field(form, "confirm");
  if (!inviteFormat.test(token)) return { error: "This link is invalid or expired. Request a new one." };
  if (password.length < 12 || password.length > 128 || password.trim().length < 12) {
    return { error: "Choose a password with at least 12 characters." };
  }
  if (password !== confirmation) return { error: "The two passwords don’t match." };

  try {
    const api = createSupabaseClient();
    const hash = inviteHash(token);
    const check = await api.rpc("carecircle_check_verify_link", {
      p_token: serverToken(), p_client: await clientHash(), p_hash: hash,
    });
    if (check.error?.code === "P0001") return { error: "Too many attempts. Wait a while and try again." };
    if (check.data !== true) return { error: "This link is invalid, expired, or already used." };

    const { data, error } = await api.rpc("carecircle_finish_enrollment", {
      p_token: serverToken(), p_hash: hash, p_password_hash: await hashPassword(password),
    });
    const account = accountIdentity(data);
    if (error?.code === "23505") return { error: "This email already has an account. Sign in with that account." };
    if (error || !account) return { error: "This link is invalid, expired, or already used." };

    await setCareSession(account.profile_id, account.role, account.id);
  } catch {
    return { error: "CareCircle couldn’t set up this account. Try again." };
  }
  redirect("/dashboard");
}

export async function passwordSignIn(_previous: AccessState, form: FormData): Promise<AccessState> {
  const email = text(form, "email").toLowerCase();
  const password = field(form, "password");
  if (!emailFormat(email) || !password || password.length > 128) return { error: invalidSignIn };

  try {
    const { data, error } = await createSupabaseClient().rpc("carecircle_password_account", {
      p_token: serverToken(), p_client: await clientHash(), p_email: email,
    });
    if (error?.code === "P0001") return { error: "Too many sign-in attempts. Wait a while and try again." };
    if (error) return { error: "Sign-in is temporarily unavailable. Try again." };
    const matches = await passwordMatches(password, data?.password_hash);
    const account = accountIdentity(data);
    if (!matches || !account) return { error: invalidSignIn };

    await setCareSession(account.profile_id, account.role, account.id);
  } catch {
    return { error: "Sign-in is temporarily unavailable. Try again." };
  }

  redirect("/dashboard");
}

export async function inviteMember(_previous: AccessState, form: FormData): Promise<AccessState> {
  const session = await getCareSession();
  const target = text(form, "target");
  if (!session?.accountId || !accountUuid.test(target)) return { error: "Sign in as the account owner to invite a member." };
  if (!verificationAvailable()) return { error: "The email sender is temporarily unavailable." };

  try {
    const token = inviteToken();
    const { data, error } = await createSupabaseClient().rpc("carecircle_invite_account", {
      p_token: serverToken(), p_profile_id: session.profileId,
      p_account_id: session.accountId, p_target: target, p_hash: inviteHash(token),
    });
    if (!error && typeof data === "string" && await sendVerification(data, token)) {
      revalidatePath("/dashboard/account");
      return { success: "Verification email sent." };
    }
  } catch {
    // The registered address stays on the server.
  }
  return { error: "The invite couldn’t be sent. Check the member’s setup and try again." };
}

export async function joinProfile(_previous: AccessState, form: FormData): Promise<AccessState> {
  const raw = text(form, "passcode");
  const code = normalizePasscode(raw);
  if (raw.length > 64 || !validPasscode(code)) return { error: "Enter the full passcode shared with you." };

  try {
    const { data, error } = await createSupabaseClient().rpc("carecircle_join", {
      p_token: serverToken(), p_client_hash: await clientHash(), p_code_hash: passcodeHash(code),
    });
    if (error?.code === "P0001") return { error: "Too many attempts. Wait a minute and try again." };
    if (error) return { error: "CareCircle couldn’t check the passcode. Try again." };

    const match = Array.isArray(data) ? data[0] : null;
    if (!match || !isCareRole(match.role) || typeof match.profile_id !== "string") {
      return { error: "That passcode didn’t match. Check it and try again." };
    }
    await setCareSession(match.profile_id, match.role);
  } catch {
    return { error: "CareCircle couldn’t check the passcode. Try again." };
  }
  redirect("/dashboard");
}

export async function signOut() {
  await clearCareSession();
  redirect("/");
}

export async function switchAccount() {
  await clearCareSession();
  redirect("/join");
}
