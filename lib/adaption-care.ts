import "server-only";
import { isIntent, safeRoutingText, type Intent } from "./care-intents";

export function adaptionConfigured() {
  return Boolean(process.env.ADAPTION_API_KEY && process.env.ADAPTION_CARE_MODEL);
}

export async function adaptionIntent(question: string): Promise<Intent | null> {
  const apiKey = process.env.ADAPTION_API_KEY;
  const model = process.env.ADAPTION_CARE_MODEL;
  const input = safeRoutingText(question);
  if (!apiKey || !model || !input) return null;

  try {
    const response = await fetch("https://api.prod.adaptionlabs.ai/api/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, input, store: false, max_output_tokens: 64,
        instructions: "Return exactly one intent label: today, adherence, unconfirmed, appointments, permissions, clinical, other. Questions asking what dose to take, if it is safe, or asking for treatment or diagnosis are clinical. Return the label only.",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    const result = await response.json();
    const pieces = (result.output ?? []).flatMap((item: { content?: Array<{ type?: string; text?: string }> }) =>
      (item.content ?? []).filter((part) => part.type === "output_text").map((part) => part.text ?? ""));
    const label = pieces.join("").trim().toLowerCase();
    return isIntent(label) ? label : null;
  } catch {
    return null;
  }
}
