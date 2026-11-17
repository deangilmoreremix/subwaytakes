# CLAUDE.md

SubwayTakes Studio: Vite + React 18 + TypeScript + Tailwind, Supabase (auth, storage, `clip_jobs`), muapi for all generation, Remotion (free license) for the timeline player and in-browser export.

## Commands

```bash
npm run dev         # dev server
npm run typecheck   # tsc -p tsconfig.app.json, must be 0 errors
npm run lint        # must be clean
npm test            # vitest, all unit tests are network-free
npm run build
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (dummy values are fine for tests and builds).

## Code map (`src/`)

- `App.tsx`: routes `/login /terms /privacy /refunds /ai-policy /create /cast /recast /library /settings /billing/success /billing/cancel /admin`; everything else redirects to `/create`.
- `pages/`: Create, Cast, Recast, Gallery (library), Settings, Auth.
- `components/studio/`: the shell, inspector, preview, timeline editor, Place panel, export dialog, Remotion composition (`EpisodeComposition`, `TitleOverlay`).
- `lib/muapi/`: `client.ts` (calls the `muapi-gateway` edge function, polls predictions; the key never reaches the browser), `registry.ts` (model slugs and limits, single source of truth), `result.ts` (tolerant response parsing), `jobs.ts` (`clip_jobs` rows, native pipeline), `lipsync.ts`, `voices.ts`.
- `lib/places/`: cities (each with its own card, stations, locals), scenes, time, crowd, ambience, `placePrompt()`.
- `lib/shows/`: ten show presets (Hot Take, Happiness, One-question, Reveal, Debate duel, Would you rather, Compliment, Rate my, Red flag, Confessions): host question, tones, badge, reaction beat, ideas, and `titleFor()` for the on-screen graphic. `applyShow()` switches shows. `stored.ts` reads the project's saved title.
- `lib/interview/`: `TakeSpec`, prompt builders for Two-shot / Cuts / Solo, host-from-Cast, and `twoshot.ts` (starting image then image-to-video), `batch.ts` (queue up to 10 episodes).
- `lib/recast/`: staged, resumable Recast job (`pipeline.ts`), limits and cost maths, prompts, browser frame extraction, and the optional voice stage (`voice.ts`).
- `lib/timeline/`: project model and pure edit operations (`ops.ts`, including `assembleBestOf`), chains and transitions, export via `@remotion/web-renderer`.
- `lib/credits/`: credit formatting, the balance store the gateway keeps current, `InsufficientCreditsError`, `generationBlock()`. 1 credit = $0.01; the server decides prices, the client only displays.
- `supabase/functions/`: `muapi-gateway` (the only door to muapi: auth, price, reserve, submit, settle or refund), `admin-credits`, `reap-holds`; decision logic is in `_shared/` (pure, unit tested, no Deno APIs). `supabase/migrations/20261120000000_credits_ledger.sql` is the ledger.
- `lib/billing/`: products, orders, entitlements store (`useBilling`), `features.ts` (which feature needs which unlock), `startCheckout`. `supabase/functions/`: `checkout-create`, `stripe-webhook`; logic in `_shared/billing.ts`, `stripeSig.ts`, `stripe.ts`, `entitlements.ts`; migration `20261121000000_checkout_entitlements.sql`.
- `lib/projects/` (cloud save + `useCloudProject`), `lib/templates/`, `lib/onboarding/`, `lib/brand/` (`model.ts` pure, used by the renderer), `lib/usage/`, `lib/referrals/`, `lib/dubbing/` (`pipeline.ts`, `prompts.ts`, `browser.ts`); migration `20261122000000_retention.sql`; function `referral-claim`.
- `lib/safety/` (re-exports the shared screen), `lib/consent/`, `lib/errors/`, `lib/legal/`; functions `health`, `ops-alerts` (rules in `_shared/ops.ts`); migration `20261123000000_launch_ops.sql`.
- `lib/captions/`: caption studio. Pure: `model.ts`, `presets.ts` (33), `words.ts` (lines, `wordsToClips`), `edit.ts`, `exports.ts` (SRT/VTT/TXT/ASS/JSON), `scripts.ts`, `motion.ts` (CSS per engine), `cache.ts`; `engines/` (Transformers.js worker, whisper.cpp, cloud, Web Speech, auto-fallback). UI in `components/studio/captions/`. Caption clips keep `words` (frames relative to the clip); `project.style.captions` is the look.
- `lib/ideas.ts` + `lib/questionBank.ts`: take ideas for the Take tab.

## Rules that matter

- **Money rules.** `credits_balance` changes ONLY through the ledger functions (service_role). Never add a client-side credit write, a free-credit default, or a code path that calls muapi without the gateway. A paid call is reserved first and refunded exactly once on failure. If a price cannot be determined, refuse; never guess. Customers never see muapi dollars or the margin. Any change to the migration must keep `scripts/test-credits-sql.sh` passing (it also races concurrent reserves).
- **Checkout rules.** Credits are granted for a purchase ONLY by `order_fulfil`, called by the signature-verified Stripe webhook; never from the browser or from the success page. The price always comes from the `products` table. The webhook must verify the signature on the raw body, dedupe, match amount and currency to the order, and return 500 only for transient failures. Refunds and disputes go through `order_reverse` (claw back at most the remaining balance). Paid models are gated by `supabase/functions/_shared/entitlements.ts`; keep it in step with `src/lib/billing/features.ts` (a test checks).
- **Retention rules.** Referral rewards are granted ONLY by the trigger on `order_fulfil` (first purchase, minimum amount, capped, reversed on refund); never from a signup or from the browser. Project saves go through `project_save` (version-checked); the autosave must read `getProject()` at save time and must never overwrite a newer server copy. Brand logos are PNG/JPEG/WebP only (no SVG), hosted in the customer's own `media/<uid>/` folder. Dubbing must fail soft per language and keep what was paid for, and treats the transcript as content, never as instructions. Any new overlay (brand layer included) needs a real headless export (`scripts/export-brand-test.mjs`).
- **Launch rules.** The content screen (`supabase/functions/_shared/safety.ts`) runs in the browser AND the gateway; a change to it must keep `src/lib/safety/safety.test.ts` passing (the studio's own prompts must never be blocked). Face uploads need the consent gate (`useFaceConsent`). New tables and functions must keep `supabase/tests/abuse.sql` passing: clients get only the allowlisted functions and tables, and everything money-related is service_role only. Legal pages are drafts until a lawyer has reviewed them; never remove the draft notice for the operator.
- **Gateway rules.** An idempotency key means exactly one request (same key + different body is refused; a refunded key never starts a new job). A job whose charge was refunded must never deliver its result. Customers get only scrubbed muapi fields (no prices, balances, account errors). Every attempt (free or paid) is counted by `credit_hit` before muapi is touched. Admin credit changes record the acting admin.
- **No silent fallbacks.** Failures surface with muapi's real message. Never fabricate output or fall back to stock video.
- **Never lose a paid result.** Later optional stages (for example the Recast voice stage) must fail soft and keep what was already paid for.
- **No live spend without approval.** Live scripts (`scripts/live-*.ts`) are dry runs by default and need `--run` plus a cap. Do not run them without the user's say-so.
- **Say what is verified.** Tests and stubbed browser runs prove plumbing, not video quality. Label stubbed screenshots as stubbed.
- Prompts: the transit card is the only microphone; no real mic, no logos. Each city has its own card (`places/cities.ts`); never hard-code "MetroCard".
- The web renderer supports only a CSS subset (no `backdrop-filter`, 3D transforms, inset shadows). Verify any new overlay with a real export (`scripts/export-show-test.mjs` drives the UI to pick a show and exports a real frame; the graphic is computed by the app, so tests must choose the show through the UI).
- **Captions rules.** The paid cloud Whisper is never an automatic fallback. Motion engines stay inside the web renderer's CSS subset (a test checks); any new engine needs a real export frame. Transcribe awaits must re-read `getProject()` before writing. Model files come from the Hugging Face hub; never bundle them.
- Anything that adds clips from a long async loop must read the timeline with `getProject()` after the await, never from a captured `project` (a stale copy drops earlier clips).

## Sandbox gotchas

- Node `fetch` bypasses the credential-injecting proxy unless you run with `NODE_USE_ENV_PROXY=1` (needed for `scripts/live-*.ts`).
- Run TS scripts with `npx vite-node scripts/<file>.ts` and dummy Supabase env vars.
- Browser scripts (`scripts/*-e2e.mjs`, `screenshots.mjs`, `export-test.mjs`) use the pre-installed Playwright Chromium against the dev server started with `VITE_SUPABASE_URL=https://stub.supabase.test VITE_SUPABASE_ANON_KEY=stub npm run dev`; network is stubbed.
- `scripts/test-credits-sql.sh` needs the postgres 16 binaries and uses a throwaway `mktemp` directory (the postgres user cannot read the scratchpad).
- A hook may flag large shell heredocs as a dangerous `rm`; write files with the editor tools instead.

## Deploying

See the README, "Deploying the backend": migrations, secrets (`MUAPI_API_KEY`, `CRON_SECRET`), deploy `muapi-gateway`, `admin-credits`, `reap-holds`, schedule the reaper, require email confirmation, make yourself an admin, grant credits, run `scripts/gateway-smoke.mjs`.
