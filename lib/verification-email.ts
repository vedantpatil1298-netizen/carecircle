import "server-only";
import { inviteHash } from "./account-security";

function configuration() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CARECIRCLE_EMAIL_FROM;
  const publicUrl = process.env.CARECIRCLE_PUBLIC_URL ?? "https://carecircle-bay.vercel.app";
  if (!apiKey || !from) return null;

  try {
    const origin = new URL(publicUrl);
    if (origin.protocol !== "https:" && origin.hostname !== "localhost" && origin.hostname !== "127.0.0.1") return null;
    return { apiKey, from, origin };
  } catch {
    return null;
  }
}

export function verificationAvailable() {
  return configuration() !== null;
}

export async function sendVerification(email: string, token: string) {
  const config = configuration();
  if (!config) return false;
  const verify = new URL("/verify", config.origin);
  verify.searchParams.set("token", token);

  try {
    const response = await fetch((process.env.CARECIRCLE_EMAIL_API_URL ?? "https://api.resend.com") + "/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + config.apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": "carecircle/" + inviteHash(token),
      },
      body: JSON.stringify({
        from: config.from,
        to: [email],
        subject: "Set up your CareCircle account",
        text: "Open this link to verify your email and set your CareCircle password:\n\n" +
          verify.toString() + "\n\nThis link can be used once and expires in one hour. If you didn’t request it, you can ignore this email.",
      }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
