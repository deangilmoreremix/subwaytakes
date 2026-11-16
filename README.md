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
   supabase functions deploy referral-claim
   ```

4. **Schedule the reaper** every 10 minutes (Supabase Cron or any scheduler): `POST https://<project>.functions.supabase.co/reap-holds` with the header `x-cron-secret: <CRON_SECRET>`. It refunds holds that never reached muapi, and for jobs nobody has polled for 30 minutes it asks muapi: completed keeps the charge, failed refunds, still running waits (refunded only after 24 hours). It needs `MUAPI_API_KEY` too; without it, it only does the first part.
5. **Auth settings:** require email confirmation (Authentication, Providers, Email) and make sure **auto-confirm is OFF**: the gateway trusts `email_confirmed_at`. Every gateway route is refused for guests and unconfirmed emails. Consider turning anonymous sign-ins off. Limits are per account, not per IP, so a signup farm is slowed by email confirmation and the daily cap, not by rate limits.
6. **Make yourself an admin:** in the SQL editor run `insert into admin_users (user_id) select id from auth.users where email = 'you@example.com';`
7. **Grant yourself credits** on the `/admin` page, then run the smoke test (below).
8. Remove the old `muapi-proxy` function from the dashboard if it was ever deployed.
9. **Checkout (Stripe):** apply `20261121000000_checkout_entitlements.sql` (after the credits migration). Set secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `APP_URL` (your site, for example `https://studio.example.com`, where Stripe sends buyers back). Deploy `supabase functions deploy checkout-create` and `supabase functions deploy stripe-webhook --no-verify-jwt` (the Stripe signature is that endpoint's authentication). In Stripe, add a webhook endpoint `https://<project>.functions.supabase.co/stripe-webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` and `charge.dispute.created`, and copy its signing secret into `STRIPE_WEBHOOK_SECRET`. Start in Stripe **test mode**, buy with a test card, and confirm the credits and unlocks arrive; then repeat in live mode with live keys.
10. **Edit the price list** in `/admin` (Billing). The seeded prices and credit amounts are placeholders. Set your refund policy and terms text on your sales page and in your Stripe checkout settings before you take real money.

**Before applying the ledger migration to a database that has users**, check what it will turn into opening balances: `select id, credits_balance from user_profiles where credits_balance <> 0;`. Every non-zero balance becomes an `opening` ledger row (including the old 100 free credits). Existing users keep any balance they had (recorded as an `opening` ledger row). If those balances came from the old 100 free credits and you want them gone, run once: `select credit_apply(id, -credits_balance, 'adjust', 'reset legacy free credits', 'reset-legacy-1') from user_profiles where credits_balance > 0;`

### How credits work

1 credit = $0.01 of generation. Each paid call is priced from muapi's live quote (`estimate-cost`), times the margin (default 2.5, set in `gateway_settings`), rounded up. Credits are reserved before the call and refunded automatically if it fails. Limits (per call, per minute, open jobs, daily cap) and a kill switch live in `gateway_settings`; per-model price overrides and on/off live in `model_prices`.

### Retention features (Phase 9)

- **Saved projects:** the timeline is kept in the browser as a draft and, for signed-in customers, saved to their account about two seconds after each change once it has a clip. Saves are version-checked: if another device saved first, nothing is overwritten and the customer chooses between the other copy and keeping theirs as a new project. Up to 50 projects of 512 KB each per customer. Apply `20261122000000_retention.sql` (after the credits and billing migrations).
- **Onboarding, templates, low-credit nudge:** a getting-started checklist that ticks from real state, ten one-click templates, and an amber credit pill under 150 credits. There are no free credits by design, so the checklist says plainly that generating needs credits.
- **Brand kit:** logo (PNG, JPEG or WebP under 2 MB), colours, handle and a sponsor end card, applied to titles and exports. Locked behind the `commercial` unlock as a display lock (exports are made in the browser, so it cannot be a hard paywall); without it exports carry a small "Made with SubwayTakes Studio" mark. The Commercial licence product is seeded off: switch it on in `/admin` when you have licence terms.
- **Usage and referrals:** Settings shows credits spent per week and per kind of work (failed generations net out). Referrals pay only from a referred customer's FIRST purchase of at least $10 (default: 300 credits to the referrer, 200 to the friend, 20 rewards per referrer), are reversed if that order is refunded or disputed, and are controlled in `/admin`. Deploy `supabase functions deploy referral-claim`.
- **Dubbing:** select a hosted video clip, then Clip, Dub. It transcribes once, then for each language (up to 5) translates, speaks in the chosen voice and lip-syncs the original clip, as its own video you add to the timeline. One language failing does not affect the others. Uses Sync Lipsync by default (Pro Pack or Recast). Translation quality, voice support per language and lip-sync on translated audio are unverified until a capped live run: `scripts/live-dub.ts` is a dry run by default (`--run --cap` to spend).

### How selling works

Customers buy from Settings (credit packs and unlock bundles). The browser only names a product; `checkout-create` reads the price from the `products` table, creates a pending order and a Stripe Checkout session. When Stripe confirms payment, the signed webhook calls `order_fulfil`, which in one database transaction marks the order paid, grants the credits through the ledger and records the unlocks. Duplicate deliveries do nothing. The amount and currency Stripe reports must match the order, or nothing is granted and the event is flagged "needs attention" in `/admin`. A full refund or a dispute reverses the order once: unlocks are revoked and the credits that are still unspent are taken back (never below zero; anything already spent is recorded as an unrecovered shortfall). Partial refunds are flagged for you to handle. Bundles with unlocks are one-time per customer; credit packs can be bought again.

**Unlocks** (`pro_pack`: Cuts, Cast voices, all 25 cities; `recast`: Recast; `happiness`: the Happiness show) are enforced by the gateway for anything that spends muapi money, so they cannot be bypassed from the browser. Cuts is enforced because every Cuts shot runs through a gated lip-sync model. All 25 cities and the Happiness show are only prompt text, so for those the lock is a display lock (anyone with credits could bypass it by editing the page; it costs you nothing but it is not a hard paywall). The gate is a list of the models that exist today: when you add a new lip-sync, voice or Recast model to the registry, add it to `supabase/functions/_shared/entitlements.ts` (a test fails if you forget). The Commercial licence product is seeded **off** because nothing enforces it yet (watermark-free export and brand kit come later); switch it on only when it does something. Every operator change to prices, unlocks and refunds is written to `billing_audit`. After a chargeback the account cannot buy again until you review it. If you win a dispute, restore the customer by hand in `/admin` (grant credits and unlock); won disputes and partial refunds are not automated. `/admin` can give or remove an unlock for a customer, and has a switch to turn pack locks off.

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
