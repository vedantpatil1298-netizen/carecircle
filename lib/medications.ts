import "server-only";
import { serverToken, type CareRole } from "./care-access";
import { createSupabaseClient } from "./supabase";

export const careTimeZone = "Asia/Kolkata";
export const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type Medication = {
  id: string;
  name: string;
  dosage: string;
  instructions: string | null;
  times: string[];
  days: number[];
  start_date: string;
  end_date: string | null;
};

export type Dose = {
  medication_id: string;
  name: string;
  dosage: string;
  instructions: string | null;
  scheduled_for: string;
  status: "upcoming" | "taken" | "skipped" | "unconfirmed" | "missed" | "pending";
  is_today: boolean;
};

export type MedicationOverview = {
  medications: Medication[];
  doses: Dose[];
  requests: Array<{ id: string; operation: "add" | "edit" | "remove"; payload: Partial<Medication> & { previous?: Pick<Medication, "name" | "dosage" | "times"> } }>;
};

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric", minute: "2-digit", hour12: true, timeZone: careTimeZone,
});

export function doseTime(value: string) {
  return timeFormatter.format(new Date(value));
}

export function dateInCareZone() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: careTimeZone,
  }).format(new Date());
}

export function adherence(doses: Dose[]) {
  const due = doses.filter((dose) => dose.status !== "upcoming");
  const taken = due.filter((dose) => dose.status === "taken").length;
  return { due: due.length, taken, percentage: due.length ? Math.round(taken / due.length * 100) : null };
}

export function statusLabel(status: Dose["status"]) {
  if (status === "missed" || status === "pending" || status === "unconfirmed") return "Unconfirmed";
  return status[0].toUpperCase() + status.slice(1);
}

export async function medicationOverview(profileId: string, role: CareRole) {
  const { data, error } = await createSupabaseClient().rpc("carecircle_medication_overview", {
    p_token: serverToken(), p_profile_id: profileId, p_role: role,
  });
  if (error || !data) return null;
  return data as MedicationOverview;
}
