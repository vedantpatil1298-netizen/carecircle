# CareCircle

CareCircle is a shared space for older adults, family members, and caretakers to manage medication routines and appointments together.

## Run locally

Use Node.js 24 or a compatible supported Node.js version.

1. Run `npm ci` to install the project packages.
2. Copy `.env.example` to `.env.local` and configure Supabase as described below.
3. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).
4. Configure the email sender below, then create a fictional profile using inboxes you control. Verify the caretaker or family owner first. Invite the other members from **Account** and try **Switch account**.

Run `npm run build` to check the production build. The connection check is available at `/api/health`.

## Set up Supabase

1. Create a Supabase project. In its SQL Editor, run `supabase/schema.sql` once, then run the files in `supabase/migrations/` in numeric order.
2. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the project's API URL and publishable key.
3. Set `CARECIRCLE_SERVER_TOKEN` to a random 64-character lowercase hex value. Generate one with `openssl rand -hex 32` in a private terminal. Keep it in `.env.local` and in the deployed server's environment.
4. Compute the SHA-256 hash of that exact text, with no trailing newline, and register the 64-character hash in the SQL Editor:

   ```sql
   insert into carecircle_private.server_config (token_hash)
   values ('YOUR_SHA256_HASH');
   ```

## Project structure

- `app/` contains pages, form actions, and the connection check.
- `components/` contains shared forms and layouts.
- `lib/` contains Supabase and session helpers.
- `supabase/` contains the base schema and later migrations.

New profiles use email-verified role accounts. The first caretaker or family member receives a single-use verification link and chooses a password. The owner can invite the other registered members from **Account**. Each uses their own email and password. Existing role passcodes are accepted only for older profiles without verified accounts.

Passwords use salted scrypt hashes. Verification links expire after one hour and are stored as keyed hashes. Successful sign-in sets an expiring signed cookie scoped to the care profile and role. Profile records and email addresses are held in a private database schema.

### Verification emails

Set `RESEND_API_KEY` to a Resend sending key and `CARECIRCLE_EMAIL_FROM` to an address on a verified sending domain. Set `CARECIRCLE_PUBLIC_URL` to the HTTPS deployment URL (or the local preview URL for development). Add the same variables to the Vercel production environment and redeploy. The setup page shows an availability message if email delivery is unconfigured.

The dashboard has separate routes for care overview, medication schedules, appointments, dose history, the care assistant, and account management. Individual pages load only their relevant data.

## Medication tracking and the care assistant

- Schedules use India Standard Time. Add the dose and directions from the existing instructions, select days and times, and mark due entries as taken or skipped.
- The seven-day percentage divides recorded taken doses by all doses that have become due. A dose without a response is shown as unconfirmed.
- A caretaker can log a dose and propose schedule changes. The older adult approves or rejects those changes. Family members have read access.
- Caretakers and family members can ask the care assistant about the schedule, unconfirmed doses, or the seven-day log. Responses come from the signed-in profile’s records. Medical decisions are referred to the care team.

The assistant ships with a small local intent classifier. Set `ADAPTION_API_KEY` and `ADAPTION_CARE_MODEL` only when an Adaption-hosted model ID or `stack:<slug>` is ready. That model receives a reduced question for routing. The care records and the answer stay in CareCircle. If model routing is unavailable, the local classifier can still answer from the log.

## Shared appointments

Everyone on a care profile can add and view upcoming visits in India Standard Time. The older adult and caretaker can edit or remove shared visits. The dashboard also lists the last seven days of due dose entries.
