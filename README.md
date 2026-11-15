# SubwayTakes Studio

Make short "subway take" interview videos: a host and a guest sit side by side on a train, both hold the city's transit card up like a microphone, and the guest defends a bold take. You write the take, choose where it happens, pick how it is shot, and edit and export the episode in the browser.

Everything generative runs through [muapi](https://muapi.ai) via a server-side gateway that holds your key and charges customers in credits. Supabase provides sign-in, storage, the job table and the credits ledger.

## What you can do

| Area | What it does |
| --- | --- |
| **Create** | Write a take (or pick one from Ideas), choose a **Place**, pick an interview format and a model, generate a shot, then cut it on the timeline. |
| **Place** | 25 real cities (each with its own transit card, real stations, local signage and style), 10 scenes, time of day, crowd, ambient sound, NYC lines and stations, and a street mode. |
| **Shows** | Ten show presets on the same card-as-mic format: Hot Take, Happiness, One-question, Reveal (number graphic), Debate duel, Would you rather, Compliment, Rate my (score sticker), Red flag / green flag, Confessions. Plus series label, batch queue (up to 10) and a Best-of assembler. |
| **Interview formats** | **Two-shot** (host and guest side by side, native-audio video), **Cuts** (host then guest as two lip-synced shots), **Solo** (guest close-up). A Cast host with a portrait keeps the same face in Two-shot. |
| **Cast** | Characters with a portrait (upload or generate) and a voice (ElevenLabs or MiniMax). |
| **Recast** | Replace the performer in a 4-15 second clip with a Cast character, optionally giving them a new voice with the mouth re-animated. |
| **Timeline and export** | Multi-track editor on the free `@remotion/player`; captions, transitions, sound effects, light leaks, on-screen take title; exports MP4 or WebM in the browser with `@remotion/web-renderer`. |

## Verified and not verified

Be honest with yourself about what has been proven:

- **Verified by unit tests and stubbed browser runs:** prompt building for every city, request bodies, stage order, resume, failure handling, the timeline, and a real browser export (title overlay included).
- **Verified against the live muapi API (earlier phases):** the OmniHuman lip-sync clip and a Wan 3.0 recast with the source audio restored.
- **Not verified yet (needs a real run):** whether Veo, Kling or Seedance render two speakers holding the card as the microphone, whether the starting-image Two-shot keeps both faces, and how good lip-sync looks on generated faces. Use `scripts/live-interview.ts` (dry run by default) to test with your key.

## Setup

Requirements: Node 20+, a Supabase project, a muapi account with funds (the server holds your muapi key; customers never see it).

```bash
npm install
cp .env.example .env   # then fill in the two Supabase values
npm run dev
```

### Deploying the backend (once)

1. **Apply the migrations** in `supabase/migrations/`. The newest three add `clip_jobs`, Cast voice columns and the `media` bucket, and the **credits ledger** (`20261120000000_credits_ledger.sql`). The ledger migration also locks down `user_profiles`: before it, a signed-in user could edit their own `credits_balance` from the browser.
2. **Set secrets** (Supabase dashboard, Edge Functions, Secrets, or `supabase secrets set`):
   - `MUAPI_API_KEY`: your muapi key. It is used only inside the gateway.
   - `CRON_SECRET`: any long random string, for the refund job.
3. **Deploy the functions:**

   ```bash
   supabase functions deploy muapi-gateway
   supabase functions deploy admin-credits
   supabase functions deploy reap-holds --no-verify-jwt
   ```

4. **Schedule the refund job** every 10 minutes (Supabase Cron or any scheduler): `POST https://<project>.functions.supabase.co/reap-holds` with the header `x-cron-secret: <CRON_SECRET>`. It refunds holds that never resolved (for example a closed tab).
5. **Auth settings:** require email confirmation (Authentication, Providers, Email). Generation is refused for guests and unconfirmed emails. Consider turning anonymous sign-ins off.
6. **Make yourself an admin:** in the SQL editor run `insert into admin_users (user_id) select id from auth.users where email = 'you@example.com';`
7. **Grant yourself credits** on the `/admin` page, then run the smoke test (below).
8. Remove the old `muapi-proxy` function from the dashboard if it was ever deployed.

Existing users keep any balance they had (recorded as an `opening` ledger row). If those balances came from the old 100 free credits and you want them gone, run once: `select credit_apply(id, -credits_balance, 'adjust', 'reset legacy free credits', 'reset-legacy-1') from user_profiles where credits_balance > 0;`

### How credits work

1 credit = $0.01 of generation. Each paid call is priced from muapi's live quote (`estimate-cost`), times the margin (default 2.5, set in `gateway_settings`), rounded up. Credits are reserved before the call and refunded automatically if it fails. Limits (per call, per minute, open jobs, daily cap) and a kill switch live in `gateway_settings`; per-model price overrides and on/off live in `model_prices`.

### Testing the backend

```bash
npm test                       # includes the gateway and admin logic tests (fake muapi, no network)
scripts/test-credits-sql.sh    # runs the migration on a throwaway local Postgres, with real concurrency races
SUPABASE_URL=... SUPABASE_ANON_KEY=... TEST_EMAIL=... TEST_PASSWORD=... node scripts/gateway-smoke.mjs   # deployed gateway, dry run (free)
```

Add `--run --cap 200` to the smoke test to make one real cheap generation with a test account.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (vitest) |

Live and browser scripts live in `scripts/` (see `CLAUDE.md`). The live ones are dry runs unless you pass `--run` and a spend cap.

## Cost

Customers pay in credits. Before any action the app shows its price in credits (from the server's live quote) and asks for confirmation above 100 credits ($1). Typical numbers at the time of writing, at the default 2.5x margin: a Two-shot clip about 150 to 225 credits, a lip-synced shot about 100, a Recast about 400. Prices follow muapi's prices, so check the quotes in the app and your margin regularly (`/admin` shows estimated muapi cost against credits sold).

## Architecture

See `CLAUDE.md` for the code map. In short: `src/lib/muapi` is the client and model registry, `src/lib/places` and `src/lib/interview` build prompts, `src/lib/recast` runs the multi-stage Recast job in the browser (resumable), and `src/lib/timeline` holds the editor model and export.
