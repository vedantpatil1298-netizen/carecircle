# CareCircle

CareCircle is a shared space for older adults, family members, and caretakers to manage medication routines and appointments together.

## Run locally

Use Node.js 24 or a compatible supported Node.js version.

1. Run `npm ci` to install the project packages.
2. Copy `.env.example` to `.env.local` and configure Supabase as described below.
3. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).
4. Create a care profile with a fictional name, save the three passcodes, and sign out. Use **Join with a passcode** to try each role.

Run `npm run build` to check the production build. The connection check is available at `/api/health`.

## Set up Supabase

1. Create a Supabase project. In its SQL Editor, run the contents of `supabase/schema.sql` once.
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
- `supabase/schema.sql` defines the private care records and database functions.

Passcodes are shown once and stored as keyed hashes. The server verifies each passcode and keeps the selected role in a signed, expiring cookie. Care profiles and contact emails are held in a private database schema.
