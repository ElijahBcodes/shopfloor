# ShopFloor

ShopFloor is a CNC production board for tracking work orders, machine availability, and shift priorities. Signed-in members of a shop share the same board; row-level security keeps each shop's data separate.

## What it does

- Tracks queued, active, paused, and completed jobs alongside machine assignments and capacity.
- Creates and edits work orders, then updates job and machine status together.
- Syncs changes across signed-in members of the same shop with Supabase Realtime.
- Uses email/password sign-in and one-use, seven-day shop invite codes.
- Can create a shop with an editable example board, or start with an empty shop.

The example jobs and machines are marked as starter data. They are not live machine telemetry.

## Configure Supabase

1. Create a Supabase project.
2. In the SQL Editor, run `supabase/migrations/001_shopfloor_shared_workspaces.sql`.
3. In Supabase Auth, enable email/password sign-in and set the site's URL plus allowed redirect URLs to your deployed app URL and local development URL.
4. Copy `.env.example` to `.env.local` and fill in the project URL and publishable/anon key. These are public browser configuration values; never put a service-role key in the frontend.
5. Add the same two `VITE_SUPABASE_*` values to the Vercel project's environment variables, then redeploy.

For local development, use `http://localhost:5173` as the local Auth redirect URL.

## Run locally

```sh
npm install
cp .env.example .env.local
# Set the Supabase values in .env.local
npm run dev
```

## Checks

```sh
npm run lint
npm run build
```

## Data and security

Shop membership is checked in PostgreSQL policies on every data query and write. The browser only uses the Supabase publishable/anon key; shop creation, invite issuance/redemption, and job/machine status transitions run through restricted database functions. Invite codes are stored as hashes, expire after seven days, and can only be redeemed once.

The old browser-local prototype data is not automatically copied into the database. Choose the example board when creating a shop, or start empty and enter the shop's live work orders.
