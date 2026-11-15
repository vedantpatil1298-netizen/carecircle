import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCareSession, serverToken } from "./care-access";
import { createSupabaseClient } from "./supabase";

export const requireDashboardSession = cache(async () => {
  const session = await getCareSession();
  if (!session) redirect("/join");
  return session;
});

export async function dashboardProfile(profileId: string) {
  const { data, error } = await createSupabaseClient().rpc("carecircle_profile", {
    p_token: serverToken(), p_profile_id: profileId,
  });
  return { name: typeof data === "string" ? data : null, unavailable: !!error };
}
