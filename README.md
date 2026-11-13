# SubwayTakes Studio

Make short "subway take" interview videos: a host and a guest sit side by side on a train, both hold the city's transit card up like a microphone, and the guest defends a bold take. You write the take, choose where it happens, pick how it is shot, and edit and export the episode in the browser.

Everything generative runs through [muapi](https://muapi.ai) with your own API key. Supabase provides sign-in, storage and the job table.

## What you can do

| Area | What it does |
| --- | --- |
| **Create** | Write a take (or pick one from Ideas), choose a **Place**, pick an interview format and a model, generate a shot, then cut it on the timeline. |
| **Place** | 25 real cities (each with its own transit card, real stations, local signage and style), 10 scenes, time of day, crowd, ambient sound, NYC lines and stations, and a street mode. |
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

Requirements: Node 20+, a Supabase project, a muapi API key.

```bash
npm install
cp .env.example .env   # then fill in the two Supabase values
npm run dev
```

1. **Supabase:** apply the migrations in `supabase/migrations/` (the two newest add `clip_jobs`, Cast voice columns and the `media` storage bucket), then deploy the proxy:

   ```bash
   supabase functions deploy muapi-proxy
   ```

2. **muapi key:** open **Settings** in the app and paste your key. It stays in your browser and is sent with each request through the `muapi-proxy` function, which stores nothing.

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

muapi bills per call and prices change. Every generation shows an estimate first (from muapi's `estimate-cost`) and asks for confirmation above $1. Typical numbers at the time of writing: a Two-shot clip about $0.60 to $0.90, a lip-synced shot about $0.40, a Recast about $1.50.

## Architecture

See `CLAUDE.md` for the code map. In short: `src/lib/muapi` is the client and model registry, `src/lib/places` and `src/lib/interview` build prompts, `src/lib/recast` runs the multi-stage Recast job in the browser (resumable), and `src/lib/timeline` holds the editor model and export.
