import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  medications: vi.fn(),
  appointments: vi.fn(),
  configured: vi.fn(),
  model: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../lib/care-access", () => ({ getCareSession: mocks.session, serverToken: () => "test-token" }));
vi.mock("../lib/supabase", () => ({ createSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("../lib/adaption-care", () => ({ adaptionConfigured: mocks.configured, adaptionIntent: mocks.model }));
vi.mock("../lib/medications", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/medications")>(),
  medicationOverview: mocks.medications,
}));
vi.mock("../lib/appointments", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/appointments")>(),
  upcomingAppointments: mocks.appointments,
}));

import { POST } from "../app/api/care-chat/route";
import { localIntent, safeRoutingText } from "../lib/care-intents";

const url = "https://carecircle.example/api/care-chat";
const profileId = "fixture-profile";
function request(question: unknown, origin = "https://carecircle.example") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ question }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ profileId, role: "family" });
  mocks.configured.mockReturnValue(false);
  mocks.medications.mockResolvedValue({
    doses: [
      { name: "First", scheduled_for: "2026-11-15T02:30:00Z", status: "taken", is_today: true },
      { name: "Second", scheduled_for: "2026-11-15T07:30:00Z", status: "unconfirmed", is_today: true },
      { name: "Third", scheduled_for: "2026-11-15T14:30:00Z", status: "upcoming", is_today: true },
    ],
  });
});

describe("care assistant routing", () => {
  it.each([
    ["What’s scheduled today?", "today"],
    ["Which doses are unconfirmed?", "unconfirmed"],
    ["Show the weekly dose log", "adherence"],
    ["When is the next appointment?", "appointments"],
    ["Can I double the dose?", "clinical"],
    ["abcdefghxyz", "other"],
  ])("routes %s to %s", (question, intent) => expect(localIntent(question)).toBe(intent));

  it("omits arbitrary identifiers from external routing input", () => {
    const reduced = safeRoutingText("Show today for Xyzpatient xyz123@example.invalid 9845123456");
    expect(reduced).toContain("today");
    expect(reduced).not.toMatch(/xyz|example|9845/);
  });
});

describe("care chat endpoint", () => {
  it("rejects missing sessions, elder sessions, and cross-origin requests", async () => {
    mocks.session.mockResolvedValueOnce(null).mockResolvedValueOnce({ profileId, role: "elder" });
    for (const input of [request("Today"), request("Today"), request("Today", "https://elsewhere.example")]) {
      const response = await POST(input);
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(mocks.medications).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON, blank questions and oversized UTF-8 bodies", async () => {
    const malformed = new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    const multibyte = new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "today", padding: "界".repeat(600) }),
    });
    for (const input of [malformed, multibyte, request(" "), request("x".repeat(361)), request(25)]) {
      expect((await POST(input)).status).toBe(400);
    }
    expect(mocks.medications).not.toHaveBeenCalled();
  });

  it("uses the signed-in profile and leaves upcoming entries out of adherence", async () => {
    const response = await POST(request("Show the weekly dose log"));
    expect(await response.json()).toMatchObject({ answer: expect.stringContaining("1 of 2"), engine: "local" });
    expect(mocks.medications).toHaveBeenCalledWith(profileId, "family");
  });

  it("returns only unconfirmed doses from today's schedule", async () => {
    const { answer } = await (await POST(request("Which doses are unconfirmed?"))).json();
    expect(answer).toContain("Second");
    expect(answer).not.toMatch(/First|Third/);
  });

  it("handles clinical questions before provider calls and record access", async () => {
    mocks.configured.mockReturnValue(true);
    const response = await POST(request("Should I take a double dose now?"));
    expect(await response.json()).toMatchObject({ answer: expect.stringContaining("pharmacist"), engine: "local" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.medications).not.toHaveBeenCalled();
  });

  it("uses only the active profile for appointments and keeps private notes out of the reply", async () => {
    mocks.configured.mockReturnValue(true);
    mocks.appointments.mockResolvedValue([{ doctor_name: "Demo clinic", scheduled_at: new Date(Date.now() + 86_400_000).toISOString(), notes: "private note" }]);
    const { answer } = await (await POST(request("When is the next appointment?"))).json();
    expect(answer).toContain("Demo clinic");
    expect(answer).not.toContain("private note");
    expect(mocks.appointments).toHaveBeenCalledWith(profileId);
    expect(mocks.model).not.toHaveBeenCalled();
  });

  it("uses the local answer when the external provider is unavailable", async () => {
    mocks.configured.mockReturnValue(true);
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.model.mockResolvedValue(null);
    const response = await POST(request("What’s scheduled today?"));
    expect(await response.json()).toMatchObject({ engine: "local", answer: expect.stringContaining("Third") });
    expect(mocks.rpc).toHaveBeenCalledWith("carecircle_chat_budget", expect.objectContaining({ p_profile_id: profileId }));
  });

  it("returns an explicit unavailable response if the care log can't be read", async () => {
    mocks.medications.mockResolvedValue(null);
    expect((await POST(request("Show the weekly dose log"))).status).toBe(503);
  });
});
