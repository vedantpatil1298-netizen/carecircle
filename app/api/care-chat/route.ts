import { adaptionConfigured, adaptionIntent } from "../../../lib/adaption-care";
import { getCareSession, serverToken } from "../../../lib/care-access";
import { localIntent } from "../../../lib/care-intents";
import { adherence, doseTime, medicationOverview, statusLabel } from "../../../lib/medications";
import { createSupabaseClient } from "../../../lib/supabase";

export async function POST(request: Request) {
  const session = await getCareSession();
  if (!session || session.role === "elder") {
    return Response.json({ error: "Sign in as a caretaker or family member." }, { status: 403 });
  }

  if (request.headers.has("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Open CareCircle to use the assistant." }, { status: 403 });
  }

  let question: string;
  try {
    const raw = await request.text();
    if (raw.length > 1600) throw new Error("Body too long");
    const data = JSON.parse(raw);
    question = typeof data?.question === "string" ? data.question.trim() : "";
    if (!question || question.length > 360) throw new Error("Invalid question");
  } catch {
    return Response.json({ error: "Enter a question of up to 360 characters." }, { status: 400 });
  }

  const local = localIntent(question);
  let intent = local;
  let engine = "local";
  if (local !== "clinical" && adaptionConfigured()) {
    const budget = await createSupabaseClient().rpc("carecircle_chat_budget", {
      p_token: serverToken(), p_profile_id: session.profileId,
    });
    const predicted = budget.error ? null : await adaptionIntent(question);
    if (predicted) {
      intent = predicted;
      engine = "adaption";
    }
  }

  const answer = (text: string) => Response.json({ answer: text, engine }, { headers: { "Cache-Control": "no-store" } });

  if (intent === "clinical") {
    return answer("Please ask the prescribing clinician or pharmacist what to do. I can show what CareCircle has recorded for this profile.");
  }

  if (intent === "permissions") {
    return answer("The older adult and caretaker can log doses. A caretaker can propose schedule changes for the older adult to approve. Family members can view the shared schedule and dose log.");
  }

  if (intent === "other") {
    return answer("Try asking what’s scheduled today, which doses are unconfirmed, or how many doses were recorded as taken this week.");
  }

  const overview = await medicationOverview(session.profileId, session.role);
  if (!overview) return Response.json({ error: "The care log is temporarily unavailable." }, { status: 503 });

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
