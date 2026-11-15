"use server";

import { redirect } from "next/navigation";
import {
  clearCareSession, clientHash, generatePasscode, isCareRole,
  normalizePasscode, passcodeHash, serverToken, setCareSession, validPasscode,
  type CareRole,
} from "../lib/care-access";
import { createSupabaseClient } from "../lib/supabase";

type AccessState = { error?: string; passcodes?: Record<CareRole, string> };

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function createProfile(_previous: AccessState, form: FormData): Promise<AccessState> {
  const name = readText(form, "elderName");
  const caretakerEmail = readText(form, "caretakerEmail").toLowerCase();
  const familyEmail = readText(form, "familyEmail").toLowerCase();
  if (!name || name.length > 80) return { error: "Enter a name between 1 and 80 characters." };
  if (caretakerEmail && !validEmail(caretakerEmail)) return { error: "Enter a valid caretaker email." };
  if (familyEmail && !validEmail(familyEmail)) return { error: "Enter a valid family email." };

  try {
    const passcodes = {
      elder: generatePasscode(),
      caretaker: generatePasscode(),
      family: generatePasscode(),
    };

    const { data, error } = await createSupabaseClient().rpc("carecircle_create_profile", {
      p_token: serverToken(),
      p_client_hash: await clientHash(),
      p_name: name,
      p_caretaker_email: caretakerEmail || null,
      p_family_email: familyEmail || null,
      p_elder_hash: passcodeHash(passcodes.elder),
      p_caretaker_hash: passcodeHash(passcodes.caretaker),
      p_family_hash: passcodeHash(passcodes.family),
    });

    if (error?.code === "P0001") return { error: "Too many profiles were created from this connection. Try again later." };
    if (error || typeof data !== "string") return { error: "CareCircle couldn’t create the profile. Try again." };

    await setCareSession(data, "elder");
    return { passcodes };
  } catch {
    return { error: "CareCircle couldn’t create the profile. Try again." };
  }
}

export async function joinProfile(_previous: AccessState, form: FormData): Promise<AccessState> {
  const raw = readText(form, "passcode");
  const code = normalizePasscode(raw);
  if (raw.length > 64 || !validPasscode(code)) {
    return { error: "Enter the full passcode shared with you." };
  }

  try {
    const { data, error } = await createSupabaseClient().rpc("carecircle_join", {
      p_token: serverToken(),
      p_client_hash: await clientHash(),
      p_code_hash: passcodeHash(code),
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
  redirect("/join");
}
