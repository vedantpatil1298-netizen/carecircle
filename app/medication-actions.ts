"use server";

import { revalidatePath } from "next/cache";
import { getCareSession, serverToken } from "../lib/care-access";
import { createSupabaseClient } from "../lib/supabase";

type ActionState = { error?: string; success?: string };
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function field(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: string) {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function saveMedication(_state: ActionState, form: FormData): Promise<ActionState> {
  const session = await getCareSession();
  if (!session || session.role === "family") return { error: "Sign in as the older adult or caretaker to change a schedule." };

  const operation = field(form, "operation");
  if (!["add", "edit", "remove"].includes(operation)) return { error: "Choose a schedule action." };
  const id = field(form, "id");
  if (operation !== "add" && !uuid.test(id)) return { error: "That schedule is no longer available." };

  const name = field(form, "name");
  const dosage = field(form, "dosage");
  const instructions = field(form, "instructions");
  const start = field(form, "start");
  const end = field(form, "end");
  const times = [...new Set(form.getAll("times").filter((value): value is string => typeof value === "string" && value !== ""))].sort();
  const days = [...new Set(form.getAll("days"))].map(Number).sort();

  if (operation !== "remove") {
    if (!name || name.length > 100 || !dosage || dosage.length > 80 || instructions.length > 240) {
      return { error: "Enter a medication name and the dose from the existing instructions." };
    }
    if (times.length < 1 || times.length > 6 || times.some((time) => !timePattern.test(time)) ||
        !days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      return { error: "Choose at least one time and day." };
    }
    if (!validDate(start) || (end && (!validDate(end) || end < start))) {
      return { error: "Check the schedule’s start and end dates." };
    }
  }

  const { error } = await createSupabaseClient().rpc("carecircle_change_medication", {
    p_token: serverToken(), p_profile_id: session.profileId, p_role: session.role,
    p_operation: operation, p_payload: operation === "remove" ? { id, name } : {
      id: id || null, name, dosage, instructions: instructions || null, times, days, start_date: start, end_date: end || null,
    },
  });
  if (error) return { error: "The schedule could not be saved. Check the dates and try again." };

  revalidatePath("/dashboard");
  return { success: session.role === "caretaker" ? "Request sent for the older adult to review." :
    operation === "remove" ? "Schedule removed. Past records are still in the log." : "Schedule saved." };
}

export async function recordDose(_state: ActionState, form: FormData): Promise<ActionState> {
  const session = await getCareSession();
  if (!session || session.role === "family") return { error: "Your role can view the log." };

  const id = field(form, "id");
  const scheduled = field(form, "scheduled");
  const status = field(form, "status");
  if (!uuid.test(id) || !Number.isFinite(Date.parse(scheduled)) || !["taken", "skipped"].includes(status)) {
    return { error: "That entry could not be logged." };
  }

  const { error } = await createSupabaseClient().rpc("carecircle_log_dose", {
    p_token: serverToken(), p_profile_id: session.profileId, p_role: session.role,
    p_medication_id: id, p_scheduled_for: scheduled, p_status: status,
  });
  if (error) return { error: "That entry could not be logged. Refresh the schedule and try again." };

  revalidatePath("/dashboard");
  return { success: "Dose log updated." };
}

export async function reviewChange(_state: ActionState, form: FormData): Promise<ActionState> {
  const session = await getCareSession();
  if (!session || session.role !== "elder") return { error: "The older adult needs to review this request." };

  const id = field(form, "id");
  const choice = field(form, "choice");
  if (!uuid.test(id) || !["approve", "reject"].includes(choice)) return { error: "Choose approve or reject." };

  const { error } = await createSupabaseClient().rpc("carecircle_review_medication_change", {
    p_token: serverToken(), p_profile_id: session.profileId, p_role: session.role,
    p_request_id: id, p_approve: choice === "approve",
  });
  if (error) return { error: "This request could not be applied. The schedule may have changed since it was proposed." };

  revalidatePath("/dashboard");
  return { success: choice === "approve" ? "Change approved." : "Change rejected." };
}
