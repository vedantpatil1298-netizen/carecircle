import "server-only";
import { serverToken } from "./care-access";
import { careTimeZone } from "./medications";
import { createSupabaseClient } from "./supabase";

export type Appointment = {
  id: string;
  doctor_name: string;
  location: string | null;
  scheduled_at: string;
  notes: string | null;
};

const dateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: careTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

const time = new Intl.DateTimeFormat("en-IN", {
  timeZone: careTimeZone, hour: "numeric", minute: "2-digit", hour12: true,
});

const date = new Intl.DateTimeFormat("en-IN", {
  timeZone: careTimeZone, weekday: "short", month: "short", day: "numeric", year: "numeric",
});

export function appointmentInput(value: string) {
  return dateTime.format(new Date(value)).replace(" ", "T");
}

export function appointmentDisplay(value: string, now = new Date()) {
  const scheduled = new Date(value);
  const offset = (day: Date) => Date.parse(dateTime.format(day).slice(0, 10));
  const days = Math.round((offset(scheduled) - offset(now)) / 86_400_000);
  const relative = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  return `${relative} · ${date.format(scheduled)} · ${time.format(scheduled)} IST`;
}

export async function upcomingAppointments(profileId: string) {
  const { data, error } = await createSupabaseClient().rpc("carecircle_upcoming_appointments", {
    p_token: serverToken(), p_profile_id: profileId,
  });
  return error || !Array.isArray(data) ? null : data as Appointment[];
}
