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

- `App.tsx`: routes `/login /create /cast /recast /library /settings`; everything else redirects to `/create`.
- `pages/`: Create, Cast, Recast, Gallery (library), Settings, Auth.
- `components/studio/`: the shell, inspector, preview, timeline editor, Place panel, export dialog, Remotion composition (`EpisodeComposition`, `TitleOverlay`).
- `lib/muapi/`: `client.ts` (calls the `muapi-proxy` edge function, polls predictions), `registry.ts` (model slugs and limits, single source of truth), `result.ts` (tolerant response parsing), `jobs.ts` (`clip_jobs` rows, native pipeline), `lipsync.ts`, `voices.ts`.
- `lib/places/`: cities (each with its own card, stations, locals), scenes, time, crowd, ambience, `placePrompt()`.
- `lib/interview/`: `TakeSpec`, prompt builders for Two-shot / Cuts / Solo, host-from-Cast, and `twoshot.ts` (starting image then image-to-video).
- `lib/recast/`: staged, resumable Recast job (`pipeline.ts`), limits and cost maths, prompts, browser frame extraction, and the optional voice stage (`voice.ts`).
- `lib/timeline/`: project model and pure edit operations (`ops.ts`), chains and transitions, export via `@remotion/web-renderer`.
- `lib/ideas.ts` + `lib/questionBank.ts`: take ideas for the Take tab.

## Rules that matter

- **No silent fallbacks.** Failures surface with muapi's real message. Never fabricate output or fall back to stock video.
- **Never lose a paid result.** Later optional stages (for example the Recast voice stage) must fail soft and keep what was already paid for.
- **No live spend without approval.** Live scripts (`scripts/live-*.ts`) are dry runs by default and need `--run` plus a cap. Do not run them without the user's say-so.
- **Say what is verified.** Tests and stubbed browser runs prove plumbing, not video quality. Label stubbed screenshots as stubbed.
- Prompts: the transit card is the only microphone; no real mic, no logos. Each city has its own card (`places/cities.ts`); never hard-code "MetroCard".
- The web renderer supports only a CSS subset (no `backdrop-filter`, 3D transforms, inset shadows). Verify any new overlay with a real export (`scripts/export-title-test.mjs`).

## Sandbox gotchas

- Node `fetch` bypasses the credential-injecting proxy unless you run with `NODE_USE_ENV_PROXY=1` (needed for `scripts/live-*.ts`).
- Run TS scripts with `npx vite-node scripts/<file>.ts` and dummy Supabase env vars.
- Browser scripts (`scripts/*-e2e.mjs`, `screenshots.mjs`, `export-test.mjs`) use the pre-installed Playwright Chromium against the dev server started with `VITE_SUPABASE_URL=https://stub.supabase.test VITE_SUPABASE_ANON_KEY=stub npm run dev`; network is stubbed.
- A hook may flag large shell heredocs as a dangerous `rm`; write files with the editor tools instead.

## Deploying

Apply `supabase/migrations/20261111000000_clip_jobs.sql` and `20261112000000_cast_voice_and_media_bucket.sql`, then `supabase functions deploy muapi-proxy`.
