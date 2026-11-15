import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  revalidate: vi.fn(),
  rpc: vi.fn(),
  emailAvailable: vi.fn(),
  send: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../lib/care-access", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/care-access")>(),
  getCareSession: mocks.session,
  setCareSession: mocks.setSession,
  clearCareSession: mocks.clearSession,
  serverToken: () => "test-server-token",
  clientHash: async () => "fictional-client",
}));
vi.mock("../lib/supabase", () => ({ createSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("../lib/verification-email", () => ({ verificationAvailable: mocks.emailAvailable, sendVerification: mocks.send }));

import { saveAppointment } from "../app/appointment-actions";
import { createProfile, inviteMember, joinProfile, passwordSignIn, signOut, switchAccount, verifyAccount } from "../app/access-actions";
import { recordDose, reviewChange, saveMedication } from "../app/medication-actions";
import { appointmentInput } from "../lib/appointments";
import { hashPassword } from "../lib/account-security";

const profileId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const entryId = "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff";

function form(fields: Record<string, string | string[] | undefined>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) for (const entry of [value].flat()) data.append(key, entry);
  }
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CARECIRCLE_SERVER_TOKEN", "ab".repeat(32));
  mocks.session.mockResolvedValue({ profileId, role: "caretaker" });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.emailAvailable.mockReturnValue(true);
  mocks.send.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("medication actions", () => {
  const schedule = {
    operation: "add", name: "  Test schedule ", dosage: "Practice",
    times: ["18:00", "09:00", "18:00"], days: ["5", "2", "2"],
    start: "2028-02-29",
  };

  it("normalizes duplicate times and weekdays and uses the session role and profile", async () => {
    expect(await saveMedication({}, form({ ...schedule, role: "elder", profileId: "other-profile" })))
      .toMatchObject({ success: expect.stringContaining("review") });
    expect(mocks.rpc).toHaveBeenCalledWith("carecircle_change_medication", expect.objectContaining({
      p_profile_id: profileId, p_role: "caretaker",
      p_payload: expect.objectContaining({ name: "Test schedule", times: ["09:00", "18:00"], days: [2, 5] }),
    }));
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard/medications");
  });

  it.each([
    { start: "2027-02-29" }, { end: "2028-02-28" }, { times: ["24:00"] }, { days: [""] }, { days: ["7"] },
  ])("rejects invalid schedule fields %j before contacting the database", async (invalid) => {
    expect(await saveMedication({}, form({ ...schedule, ...invalid }))).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("denies family writes and caretaker approvals", async () => {
    mocks.session.mockResolvedValueOnce({ profileId, role: "family" });
    expect(await recordDose({}, form({ id: entryId, scheduled: "2026-11-15T02:30:00Z", status: "taken" }))).toHaveProperty("error");
    expect(await reviewChange({}, form({ id: entryId, choice: "approve" }))).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not invalidate the dashboard when logging fails", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "P0001" } });
    expect(await recordDose({}, form({ id: entryId, scheduled: "2026-11-15T02:30:00Z", status: "skipped" }))).toHaveProperty("error");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("records a due entry and revalidates both views", async () => {
    expect(await recordDose({}, form({ id: entryId, scheduled: "2026-11-15T02:30:00Z", status: "taken" })))
      .toMatchObject({ success: "Dose log updated." });
    expect(mocks.rpc).toHaveBeenCalledWith("carecircle_log_dose", expect.objectContaining({
      p_profile_id: profileId, p_medication_id: entryId, p_status: "taken",
    }));
    expect(mocks.revalidate.mock.calls.flat()).toEqual(["/dashboard", "/dashboard/history"]);
  });

  it("lets an older adult reject a request", async () => {
    mocks.session.mockResolvedValue({ profileId, role: "elder" });
    expect(await reviewChange({}, form({ id: entryId, choice: "reject" }))).toMatchObject({ success: "Change rejected." });
    expect(mocks.rpc).toHaveBeenCalledWith("carecircle_review_medication_change", expect.objectContaining({
      p_request_id: entryId, p_approve: false, p_role: "elder",
    }));
  });
});

describe("appointment actions", () => {
  it("round-trips the selected IST wall time and only allows family to add", async () => {
    mocks.session.mockResolvedValue({ profileId, role: "family" });
    const scheduled = new Date(Date.now() + 86_400_000);
    scheduled.setUTCSeconds(0, 0);
    const fields = { operation: "add", doctor: " Demo clinic ", dateTime: appointmentInput(scheduled.toISOString()) };
    expect(await saveAppointment({}, form(fields))).toMatchObject({ success: "Appointment saved." });
    expect(mocks.rpc).toHaveBeenCalledWith("carecircle_write_appointment", expect.objectContaining({
      p_scheduled_at: scheduled.toISOString(), p_doctor: "Demo clinic", p_profile_id: profileId, p_role: "family",
    }));
    expect(await saveAppointment({}, form({ ...fields, operation: "edit", id: entryId }))).toHaveProperty("error");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects a past visit and a calendar date normalized by JavaScript", async () => {
    for (const dateTime of ["2000-01-01T08:00", "2099-02-29T08:00"]) {
      expect(await saveAppointment({}, form({ operation: "add", doctor: "Demo", dateTime }))).toHaveProperty("error");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("profile enrollment", () => {
  const fields = {
    elderName: "Fictional Elder", age: "70", gender: "prefer-not-to-say",
    ownerRole: "caretaker", caretakerEmail: "OWNER@EXAMPLE.INVALID",
  };

  it("normalizes email and sends the raw link only after the database accepts a hash", async () => {
    expect(await createProfile({}, form(fields))).toHaveProperty("success");
    const [, payload] = mocks.rpc.mock.calls[0];
    expect(payload.p_details.emails.caretaker).toBe("owner@example.invalid");
    const [recipient, rawToken] = mocks.send.mock.calls[0];
    expect(recipient).toBe("owner@example.invalid");
    expect(payload.p_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.p_hash).not.toBe(rawToken);
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
  });

  it("blocks duplicate emails and skips delivery when enrollment is rate-limited", async () => {
    expect(await createProfile({}, form({ ...fields, familyEmail: "owner@example.invalid" }))).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ error: { code: "P0001" } });
    expect(await createProfile({}, form(fields))).toMatchObject({ error: expect.stringContaining("Too many") });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("checks password confirmation before sending anything to the database", async () => {
    expect(await verifyAccount({}, form({ token: "A".repeat(43), password: "long test password", confirm: "another password" }))).toMatchObject({
      error: expect.stringContaining("don’t match"),
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("checks the link before hashing the password and opens the newly verified dashboard", async () => {
    const account = { id: entryId, profile_id: profileId, role: "caretaker" };
    mocks.rpc.mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({ data: account });
    await verifyAccount({}, form({ token: "A".repeat(43), password: "long test password", confirm: "long test password" }));
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["carecircle_check_verify_link", "carecircle_finish_enrollment"]);
    expect(mocks.rpc.mock.calls[1][1].p_password_hash).toMatch(/^[0-9a-f]{32}\.[0-9a-f]{128}$/);
    expect(mocks.setSession).toHaveBeenCalledWith(profileId, "caretaker", entryId);
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("stops on an expired link and creates no session", async () => {
    mocks.rpc.mockResolvedValue({ data: false });
    expect(await verifyAccount({}, form({ token: "A".repeat(43), password: "long test password", confirm: "long test password" })))
      .toHaveProperty("error");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
});

describe("account access", () => {
  it("opens a session only for the password returned by the verified account lookup", async () => {
    const password = "long test password";
    mocks.rpc.mockResolvedValue({ data: {
      id: entryId, profile_id: profileId, role: "family", password_hash: await hashPassword(password),
    } });
    expect(await passwordSignIn({}, form({ email: "family@example.invalid", password: "wrong password" }))).toHaveProperty("error");
    expect(mocks.setSession).not.toHaveBeenCalled();
    await passwordSignIn({}, form({ email: "FAMILY@EXAMPLE.INVALID", password }));
    expect(mocks.rpc).toHaveBeenLastCalledWith("carecircle_password_account", expect.objectContaining({ p_email: "family@example.invalid" }));
    expect(mocks.setSession).toHaveBeenCalledWith(profileId, "family", entryId);
  });

  it("uses the database's verified owner and target, never a submitted email, for invitations", async () => {
    mocks.session.mockResolvedValue({ profileId, role: "caretaker", accountId: entryId });
    mocks.rpc.mockResolvedValue({ data: "registered@example.invalid" });
    expect(await inviteMember({}, form({ target: profileId, email: "other@example.invalid" }))).toHaveProperty("success");
    expect(mocks.rpc).toHaveBeenCalledWith("carecircle_invite_account", expect.objectContaining({
      p_profile_id: profileId, p_account_id: entryId, p_target: profileId,
    }));
    expect(mocks.send).toHaveBeenCalledWith("registered@example.invalid", expect.any(String));
  });

  it("keeps legacy passcodes role-scoped and clears sessions on exit or account switch", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ profile_id: profileId, role: "elder" }] });
    await joinProfile({}, form({ passcode: "ABCD-EFGH-JKMN-PQRS", role: "family" }));
    expect(mocks.setSession).toHaveBeenCalledWith(profileId, "elder");
    await switchAccount();
    await signOut();
    expect(mocks.clearSession).toHaveBeenCalledTimes(2);
    expect(mocks.redirect.mock.calls.flat()).toEqual(["/dashboard", "/join", "/"]);
  });
});
