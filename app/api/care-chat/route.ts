import { adaptionConfigured, adaptionIntent } from "../../../lib/adaption-care";
import { appointmentDisplay, upcomingAppointments } from "../../../lib/appointments";
import { getCareSession, serverToken } from "../../../lib/care-access";
import { localIntent } from "../../../lib/care-intents";
import { adherence, doseTime, medicationOverview, statusLabel } from "../../../lib/medications";
import { createSupabaseClient } from "../../../lib/supabase";

const headers = { "Cache-Control": "no-store" };
const requestLimit = 1600;

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

async function readQuestion(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new Error("Expected JSON");
  }
  if (Number(request.headers.get("content-length")) > requestLimit || !request.body) {
    throw new Error("Invalid body");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let raw = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > requestLimit) {
        void reader.cancel().catch(() => {});
        throw new Error("Body too long");
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  const data: unknown = JSON.parse(raw);
  const question = data && typeof data === "object" && "question" in data &&
    typeof data.question === "string" ? data.question.trim() : "";
  if (!question || question.length > 360) throw new Error("Invalid question");
  return question;
}

export async function POST(request: Request) {
  const session = await getCareSession();
  if (!session || session.role === "elder") {
    return failure("Sign in as a caretaker or family member.", 403);
  }

  if (request.headers.has("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return failure("Open CareCircle to use the assistant.", 403);
  }

  let question: string;
  try {
    question = await readQuestion(request);
  } catch {
    return failure("Enter a question of up to 360 characters.", 400);
  }

  const local = localIntent(question);
  let intent = local;
  let engine = "local";
  if (local !== "clinical" && local !== "appointments" && adaptionConfigured()) {
    const budget = await createSupabaseClient().rpc("carecircle_chat_budget", {
      p_token: serverToken(), p_profile_id: session.profileId,
    });
    const predicted = budget.error ? null : await adaptionIntent(question);
    if (predicted) {
      intent = predicted;
      engine = "adaption";
    }
  }

  const answer = (text: string) => Response.json({ answer: text, engine }, { headers });

  if (intent === "clinical") {
    return answer("Please ask the prescribing clinician or pharmacist what to do. I can show what CareCircle has recorded for this profile.");
  }

  if (intent === "permissions") {
    return answer("The older adult and caretaker can log doses. A caretaker can propose schedule changes for the older adult to approve. Family members can view the shared schedule and dose log.");
  }

  if (intent === "other") {
    return answer("Try asking what’s scheduled today, which doses are unconfirmed, how many doses were recorded as taken this week, or when the next appointment is.");
  }

  if (intent === "appointments") {
    const appointments = await upcomingAppointments(session.profileId);
    if (!appointments) return failure("Appointments are temporarily unavailable.", 503);
    if (!appointments.length) return answer("No upcoming appointments have been added.");
    const now = new Date();
    const lines = appointments.slice(0, 5).map((visit) =>
      `${appointmentDisplay(visit.scheduled_at, now)} · ${visit.doctor_name}`
    );
    if (appointments.length > 5) lines.push(`+${appointments.length - 5} more in Appointments.`);
    return answer(lines.join("\n"));
  }

  const overview = await medicationOverview(session.profileId, session.role);
  if (!overview) return failure("The care log is temporarily unavailable.", 503);

  if (intent === "adherence") {
    const week = adherence(overview.doses);
    if (week.percentage === null) return answer("No doses were due in the past seven days.");
    const skipped = overview.doses.filter((dose) => dose.status === "skipped").length;
    return answer(`Over the past seven days, ${week.taken} of ${week.due} doses due were recorded as taken (${week.percentage}%). ${skipped} recorded as skipped.`);
  }

  const today = overview.doses.filter((dose) => dose.is_today);
  const matches = intent === "unconfirmed"
    ? today.filter((dose) => statusLabel(dose.status) === "Unconfirmed")
    : today;
  if (!matches.length) {
    return answer(intent === "unconfirmed" ? "No doses are marked unconfirmed today." : "There are no doses scheduled today.");
  }

  const lines = matches.slice(0, 10).map((dose) => `${doseTime(dose.scheduled_for)} IST · ${dose.name} · ${statusLabel(dose.status)}`);
  if (matches.length > 10) lines.push(`+${matches.length - 10} more in Today.`);
  return answer(lines.join("\n"));
}
