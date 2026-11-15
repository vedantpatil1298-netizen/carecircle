import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const token = "ac".repeat(32);
const passwordHash = "0".repeat(32) + "." + "0".repeat(128);
const root = new URL("../supabase/", import.meta.url);

beforeAll(async () => {
  await db.exec("create role anon; create role authenticated;");
  await db.exec(await readFile(new URL("schema.sql", root), "utf8"));
  const migrations = new URL("migrations/", root);
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(file, migrations), "utf8"));
  }
  await db.query("insert into carecircle_private.server_config(token_hash) values (encode(sha256(convert_to($1, 'UTF8')), 'hex'))", [token]);
}, 20_000);

afterAll(() => db.close());

async function createProfile(name: string) {
  const { rows } = await db.query<{ id: string }>("insert into carecircle_private.profiles(elder_name) values ($1) returning id", [name]);
  return rows[0].id;
}

async function overview(profile: string) {
  const { rows } = await db.query<{ value: {
    medications: { id: string; name: string }[];
    doses: { medication_id: string; scheduled_for: string; status: string }[];
    requests: { id: string }[];
  } }>("select public.carecircle_medication_overview($1,$2,'elder') as value", [token, profile]);
  return rows[0].value;
}

describe("database boundaries", () => {
  it("keeps clinical records private and requires the server credential on the public RPC", async () => {
    const profile = await createProfile("Privacy fixture");
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from carecircle_private.medications")).rejects.toMatchObject({ code: "42501" });
      await expect(db.query("select public.carecircle_medication_overview($1,$2,'family')", ["bad-token", profile])).rejects.toMatchObject({ code: "42501" });
      await expect(overview(profile)).resolves.toMatchObject({ medications: expect.any(Array) });
    } finally {
      await db.exec("reset role");
    }
  });

  it("consumes an enrollment only once and creates a scoped owner and three practice medications", async () => {
    const details = { name: "Owner fixture", age: 72, gender: "prefer-not-to-say",
      owner_role: "caretaker", emails: { caretaker: "carer@example.invalid", elder: "elder@example.invalid" } };
    await db.query("select public.carecircle_start_enrollment($1,'client-a','address-a','invite-a',$2::jsonb)", [token, JSON.stringify(details)]);
    const finish = () => db.query<{ account: { id: string; profile_id: string; role: string } | null }>(
      "select public.carecircle_finish_enrollment($1,'invite-a',$2) as account", [token, passwordHash],
    );
    const { rows: [{ account }] } = await finish();
    expect(account).toMatchObject({ id: expect.any(String), profile_id: expect.any(String), role: "caretaker" });
    expect((await finish()).rows[0].account).toBeNull();
    expect((await overview(account!.profile_id)).medications).toHaveLength(3);
    const { rows: [{ roster }] } = await db.query<{ roster: { can_invite: boolean; members: unknown[] } }>(
      "select public.carecircle_account_roster($1,$2,$3) as roster", [token, account!.profile_id, account!.id],
    );
    expect(roster.can_invite).toBe(true);
    expect(roster.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "elder", verified: false }),
      expect.objectContaining({ role: "caretaker", verified: true }),
    ]));
  });
});

describe("care workflows", () => {
  it("requires an elder to approve a caretaker's medication proposal", async () => {
    const profile = await createProfile("Schedule fixture");
    const other = await createProfile("Other schedule fixture");
    const payload = JSON.stringify({ name: "Test schedule", dosage: "Practice", days: [0, 1, 2, 3, 4, 5, 6], times: ["00:00"] });
    const propose = (role: string) => db.query("select public.carecircle_change_medication($1,$2,$3,'add',$4::jsonb)", [token, profile, role, payload]);
    await expect(propose("family")).rejects.toMatchObject({ code: "42501" });
    await propose("caretaker");
    const pending = await overview(profile);
    expect(pending.medications).toHaveLength(3);
    expect(pending.requests).toHaveLength(1);
    const requestId = pending.requests[0].id;
    const approve = (target: string, role: string) => db.query(
      "select public.carecircle_review_medication_change($1,$2,$3,$4,true)", [token, target, role, requestId],
    );
    await expect(approve(profile, "caretaker")).rejects.toMatchObject({ code: "42501" });
    await expect(approve(other, "elder")).rejects.toThrow();
    await approve(profile, "elder");
    await expect(approve(profile, "elder")).rejects.toThrow();
    expect((await overview(profile)).medications.map(({ name }) => name)).toContain("Test schedule");
    expect((await overview(other)).medications.map(({ name }) => name)).not.toContain("Test schedule");
    expect((await overview(profile)).requests).toHaveLength(0);
  });

  it("checks a due dose belongs to the profile and logs repeated submissions once", async () => {
    const profile = await createProfile("Dose fixture");
    const other = await createProfile("Other dose fixture");
    await db.query(
      "select public.carecircle_change_medication($1,$2,'elder','add',$3::jsonb)",
      [token, profile, JSON.stringify({ name: "Midnight fixture", dosage: "Practice", days: [0, 1, 2, 3, 4, 5, 6], times: ["00:00"] })],
    );
    const before = await overview(profile);
    const medication = before.medications.find(({ name }) => name === "Midnight fixture")!;
    const dose = before.doses.find(({ medication_id }) => medication_id === medication.id)!;
    const record = (target: string, role: string, status: string) => db.query(
      "select public.carecircle_log_dose($1,$2,$3,$4,$5,$6)", [token, target, role, medication.id, dose.scheduled_for, status],
    );
    await expect(record(other, "caretaker", "taken")).rejects.toThrow();
    await expect(record(profile, "family", "taken")).rejects.toMatchObject({ code: "42501" });
    await record(profile, "caretaker", "taken");
    await record(profile, "elder", "skipped");
    expect((await overview(profile)).doses.filter(({ medication_id }) => medication_id === medication.id))
      .toEqual([expect.objectContaining({ status: "taken" })]);
  });

  it("lets family add a future visit and blocks edits from another care circle", async () => {
    const profile = await createProfile("Visit fixture");
    const other = await createProfile("Other visit fixture");
    const write = (target: string, role: string, operation: string, id: string | null, doctor: string) => db.query(
      "select public.carecircle_write_appointment($1,$2,$3,$4,$5,$6,null,now() + interval '2 days',null)",
      [token, target, role, operation, id, doctor],
    );
    const read = async (target: string) => (await db.query<{ visits: { id: string; doctor_name: string }[] }>(
      "select public.carecircle_upcoming_appointments($1,$2) as visits", [token, target],
    )).rows[0].visits;
    await write(profile, "family", "add", null, "Demo clinic");
    const [visit] = await read(profile);
    expect(visit.doctor_name).toBe("Demo clinic");
    await expect(read(other)).resolves.toEqual([]);
    await expect(write(profile, "family", "edit", visit.id, "Family edit")).rejects.toMatchObject({ code: "42501" });
    await expect(write(other, "elder", "edit", visit.id, "Other edit")).rejects.toThrow();
    await write(profile, "caretaker", "edit", visit.id, "Updated clinic");
    expect((await read(profile))[0].doctor_name).toBe("Updated clinic");
  });
});
