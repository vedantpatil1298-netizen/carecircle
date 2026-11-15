"use server";

import { revalidatePath } from "next/cache";
import { appointmentInput } from "../lib/appointments";
import { getCareSession, serverToken } from "../lib/care-access";
import { createSupabaseClient } from "../lib/supabase";

type AppointmentState = { error?: string; success?: string };
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const inputTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveAppointment(_previous: AppointmentState, form: FormData): Promise<AppointmentState> {
  const session = await getCareSession();
  if (!session) return { error: "Sign in to manage appointments." };

  const action = text(form, "operation");
  if (!["add", "edit", "remove"].includes(action) || (session.role === "family" && action !== "add")) {
    return { error: "Your role can add and view appointments." };
  }

  const id = text(form, "id");
  if (action !== "add" && !uuid.test(id)) return { error: "This appointment is unavailable." };

  const doctor = text(form, "doctor");
  const location = text(form, "location");
  const notes = text(form, "notes");
  const dateTime = text(form, "dateTime");
  let scheduled: string | null = null;

  if (action !== "remove") {
    if (!doctor || doctor.length > 100 || location.length > 160 || notes.length > 400) {
      return { error: "Enter a clinic or doctor name and check the length of your notes." };
    }
    const date = new Date(`${dateTime}+05:30`);
    if (!inputTime.test(dateTime) || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now() || appointmentInput(date.toISOString()) !== dateTime) {
      return { error: "Choose a future appointment date and time in IST." };
    }
    scheduled = date.toISOString();
  }

  const { error } = await createSupabaseClient().rpc("carecircle_write_appointment", {
    p_token: serverToken(), p_profile_id: session.profileId, p_role: session.role,
    p_action: action, p_id: id || null, p_doctor: doctor || null,
    p_location: location || null, p_scheduled_at: scheduled, p_notes: notes || null,
  });

  if (error) return { error: "The appointment couldn’t be saved. Refresh and try again." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  return { success: action === "remove" ? "Appointment removed." : "Appointment saved." };
}
