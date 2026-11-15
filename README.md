# CareCircle

CareCircle is a shared space for older adults, family members, and caretakers to manage medication routines and appointments together.

## Run locally

Use Node.js 24 or a compatible supported Node.js version.

1. Run `npm ci` to install the project packages.
2. Run `npm run dev`.
3. Open [http://localhost:3000](http://localhost:3000). The landing page shows an example schedule. Click **Check connection** to verify that the server can reach Supabase once configured.

Run `npm run build` to check that the production app builds.

## Project structure

- `app/` contains the landing page, layout, styles, and the connection check at `/api/health`.
- `components/` contains the landing page’s interactive connection check.
- `lib/supabase.ts` creates a server-side Supabase client.

## Environment variables

Copy `.env.example` to `.env.local` when configuring Supabase. In your Supabase project, find the project URL and publishable key and set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Configure the same names in Vercel. The landing page renders with sample content and does not require database credentials.
