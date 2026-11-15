import "server-only";
import { createClient } from "@supabase/supabase-js";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to connect CareCircle.");
  }

  return { url, key };
}

export function createSupabaseClient() {
  const { url, key } = getSupabaseConfig();

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function checkSupabaseConnection() {
  const { url, key } = getSupabaseConfig();
  // The Auth settings endpoint verifies the project and key before tables exist.
  const response = await fetch(new URL("/auth/v1/settings", url), {
    headers: { apikey: key },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  return response.ok;
}
