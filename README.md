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

### Vox-pop poll

Take tab, "Vox-pop poll": one question, two answer labels (Yes and No by default) and up to five guest lines that each start with the guest's label ("Yes: obviously, it is meat between bread."). A line with no known label is refused with its line number, so a count is never a guess. Each guest becomes their own Two-shot episode with the same question, a different original guest description from a pool of eight (never real people), and their own answer; after all of them a **results card** closes the video (the question, two bars that grow, whole-number percentages that add up to 100, a star on the winner, "N guests on the train"). One cost confirmation for the whole poll, a failed guest never stops the rest, and only guests whose clip was made are counted. The card is a normal timeline clip, saved in project files (re-validated on opening). Verified: planner, tally and card data by unit tests; the whole flow through the real UI with real mp4 clips and a stubbed proxy (`scripts/poll-e2e.mjs`: 3 submits, same question, three different guests, own answer lines, one-card beats, tally 2 to 1, card after the last clip); and a REAL web export of that project (15 s: three 4 s clips then the 3 s card with Yes 67% and No 33%). Not verified: a real three-guest generation (about $1.80 on a fast model).

## Game-show formats

Four new shows in the Take tab: **Quick trivia** (question card with a ? badge and a green "CORRECT" pill that pops in after two seconds), **Two truths and a lie** (up to three numbered statements, split from what the guest says on full stops, semicolons or new lines), **Finish the sentence** and **Guess the price** (the amount the guest says pops up big). They use the same one-card hand-off beats and each city's own card word as every other show. Verified by unit tests (titles, splitting, ideas pass the content screen, every city, one-card beats) and REAL web exports of the three graphics through the real UI (`scripts/export-verse-test.mjs <clip> <out> x KJV "Quick trivia"` with `ANSWER=...`). Not verified: how the video models act out the host's reveal ("Correct!", pointing at the lie) in a real clip; the trivia pill always says CORRECT, so write the right answer as the guest's answer.

## Art styles (looks)

A **Look** picker in the Take tab restyles the same interview: Documentary (default, prompts unchanged), 3D animated, Claymation, Cartoon, VHS tape, Black and white. Only the rendering style changes; the host, guest, ONE card and hand-off, each city's own card word and the content screen stay on top of every look. The look is saved with the take (project snapshot) and restored on reload. Verified by unit tests (every look x show x city passes the screen, snapshot round trip, hostile look falls back) and a stubbed browser run (`scripts/look-e2e.mjs`). Not verified: how well Veo/Kling/Seedance honour a style while keeping the hand-off (needs a real clip, about $0.60 each).

## World tour (same take, several cities)

A **World tour** box in the Take tab asks the current take in 2 to 5 cities. Only the place changes: each city keeps its own station look and its own card as the microphone (never "MetroCard" outside New York), a different original guest each time, and a "NOW IN <city>" tag sits across the upper third for the first two seconds of every stop. Price is estimated once per clip and confirmed up front; a failed city never stops the rest and paid clips are kept. Verified by unit tests (planning, per-city card words, safety screen, project-file validation of the tag), a stubbed browser run with a real mp4 (`scripts/tour-e2e.mjs`: three cities, three submits, own card word each, tags aligned with their clips) and a REAL web export of the tags (frames show the tag, then none, then the next city's tag). Not verified: real clips for each city (the export reused one real Veo clip for every stop, so it proves the tag and the cuts, not the city looks), and that a video model really draws each city's own interior.

## Narrated videos (no faces)

A **Narrated video** box in the Take tab: a voice reads a script over 3 to 6 generated pictures that drift slowly (zoom in, zoom out, pan), with the words as captions. Kinds: **Story** (your text), **List** ("Three things..." with one picture per item), **Quote** and **Verse** (whatever is picked in the Take tab, spoken and shown word for word, with the author or reference as the last scene). It is the cheapest video the app makes: ONE voice call (ElevenLabs or MiniMax, about 900 characters at most) and one picture per scene, no talking face. The voice is made first, so a failure there stops before any picture is bought; a picture that fails borrows its neighbour (with a warning, never a stock or invented image); if no picture can be made the paid voice is still kept on the timeline. Pictures are faceless and textless on purpose (no close-up faces, no real people, no children, no logos; verse scenes show no people at all). Verified by unit tests (planning, exact-text rule over 40 quotes and 60 verses, timing adds up to the voice, prompts pass the content screen, pipeline order, fail-soft, cancel, timeline placement, project-file validation), a stubbed browser run with REAL pictures and a REAL wav (`scripts/narrated-e2e.mjs`) and a REAL web export (`scripts/export-project.mjs <mediaDir> <project.json> out.mp4`). Not verified: what the real image model draws for each scene, voice quality, and whether muapi's picture links can be read by the web exporter (CORS) from your own domain; prices shown are muapi's live estimates, not the stub's. Using your own recording instead of a synthetic voice is not wired into this box yet.

## Share image and GIF teaser (free)

After an export finishes, the export dialog has "Share it": **Share image** saves a poster PNG from the best moment of your episode (optionally with one line of text along the bottom) and **GIF teaser** saves a looping GIF of up to 3 seconds, 10 frames a second, 480 px wide, refused if it would be too big to share (over about 8 MB). Both are made in the browser from the file you just exported, loaded only when you press the button. Verified with the real GIF encoder on a real exported MP4 (`scripts/share-test.mjs`: real GIF89a, 480 px wide, right shape, 18 frames for a 2-second video, about 1 MB, loops, caption bar present) and through the real export dialog (`SHARE_DIR=<dir> node scripts/export-project.mjs ...`). Not verified: very long or very detailed videos on slow phones (the GIF takes about 2 seconds per second of teaser here on CPU), and how a particular app displays the GIF.

## Crop and reframe (free)

- **Portraits** (Cast, "Crop"): crop to 9:16, 1:1 or 16:9 with zoom; only "Use this crop" uploads a PNG to your own media folder. Verified with a real portrait (`scripts/portrait-crop-e2e.mjs`: the square crop is decoded and measured).
- **Video clips** (select a clip, Clip tab, "Reframe"): zoom 1 to 3 and choose what stays in the middle over a still from the clip; the clip file is not changed, only a zoom and a focal point are stored (clips without one render exactly as before; project files re-check them). It uses plain 2D CSS so the web exporter renders it. Verified by a REAL web export of a position-coded test video, with pixels measured (`scripts/export-crop-test.mjs`: with zoom 2 at (0.75, 0.5) the middle of the frame shows the picture at 75% across, within compression error) and the editor flow with a real video file (`scripts/reframe-e2e.mjs`). Not verified: dragging by hand on touch screens, very wide sources into tall frames (the focal point is approximate when the shapes differ).

## Remove a portrait's background (free, on device)

Cast, "Remove background": Google's open MediaPipe selfie segmenter cuts the person out of a portrait on this device (the model, about 250 KB, and its WebAssembly runtime download from their official hosts the first time and are cached). Pick transparent, white, soft grey, subway yellow or the original blurred, compare before and after, and only "Use this portrait" uploads a PNG to your own media folder. It is behind the same face-photo consent as uploads. Verified with the real model on a real portrait in headless Chromium (`scripts/cutout-test.mjs`: 1.2 s on CPU, person found, corner transparent or white, centre opaque) and through the real Cast UI (`scripts/cutout-ui-e2e.mjs`, Supabase stubbed). Not verified: other browsers, phones, group photos (it is a selfie model: one person), very busy or low-contrast backgrounds.

## Project files (free)

Output tab, "Project file": **Save to file** writes the episode as `<name>.subwaytakes.json` (the native save dialog in Chrome and Edge, a download elsewhere) and **Open file** loads one back, with a confirmation before replacing what you have and undo afterwards. The file holds the timeline and the links to your clips, never the clips themselves and never your muapi key; opening refuses anything that is not a SubwayTakes project, is from a newer version, is over 5 MB, or points at non-https media. Verified by unit tests and `scripts/projectfile-e2e.mjs` (real file download and upload; the native save dialog itself is not testable headless). Not done: mirroring the draft into IndexedDB (the draft still lives in localStorage).

## Record your own voice (free)

In Voice + lipsync, "Use your own voice" opens a teleprompter, records the microphone in the browser (MediaRecorder, mono WAV made with the Web Audio API), and uploads the WAV to your own media folder. The paid text-to-speech step is skipped and the character needs no voice. A recording belongs to the exact line it was made for: edit the take and it no longer applies. Verified: the pure teleprompter and limits logic and the pipeline (unit tests), and the whole flow with Chromium's fake microphone (`scripts/record-e2e.mjs`). It works in Voice + lipsync and in Cuts (host, guest, or guest B in a duel). Not verified: real microphones and voices, other browsers (Safari records audio/mp4).

## Bring your own muapi key (the default)

Customers create their own muapi account and paste their key into the key dialog (top bar, Settings, or any Generate button). The key stays in their browser and is sent per request to the `muapi-byok` edge function, which forwards it to muapi and keeps nothing. They pay muapi directly and see a price before each run. There are no credits, packs or checkout in this mode.

To deploy this mode you need: the Supabase migrations the app uses (clip_jobs and media, retention, launch ops, and the credits migration only because it holds the rate-limit function `credit_hit` and the `safety_terms` table), and `supabase functions deploy muapi-byok`. No `MUAPI_API_KEY`, Stripe or reaper is needed. To bring the credits model back, set `VITE_BILLING_MODE=credits` and follow the sections below.

**Shared Supabase project.** The backend lives in its own schema `subwaytakes` (migration `20261125000000_subwaytakes_schema.sql`, tested by `scripts/test-subwaytakes-sql.sh`), the bucket `subwaytakes-media` and the edge function `subwaytakes-byok`. Applied to the shared project on 2026-11-20: 11 tables (all with row-level security and an `[app: subwaytakes]` comment), 4 functions, the bucket with 4 policies, and `subwaytakes` appended to the exposed schemas. Nothing outside that was changed. To deploy the function: `node scripts/bundle-byok.mjs /tmp/index.ts`, then deploy that single file as `index.ts` with JWT verification on. **Hardening (migration `20261126000000_subwaytakes_hardening.sql`).** The per-minute limit takes a per-user lock, so parallel calls cannot slip past it (tested with 60 parallel sessions); the media bucket has no public listing policy and files get 128-bit random names; only signed-in users can write to the error log. The proxy only answers browsers on an allowed origin (never `*`): the default is `https://subwaytakes.netlify.app`, its `deploy-preview-N--subwaytakes.netlify.app` previews and local dev; add a custom domain with the function setting `ALLOWED_ORIGINS="https://your.domain"`. Honest limit: the bucket is still public, so anyone who holds a file's exact URL can read it (muapi and the exporter need that). Face photos are protected by an unguessable URL, not by a login.

To remove everything: `DROP SCHEMA subwaytakes CASCADE`, delete the bucket and the function, and take `subwaytakes` out of the exposed schemas.

**Real-key check.** `node scripts/byok-smoke.mjs` (dry run) and `--run` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ST_EMAIL`, `ST_PASSWORD`, `MUAPI_KEY` set: reads your wallet balance, asks for one price, and checks a wrong key, a missing key, a path outside the allowlist and the content screen. Read-only; it cannot generate or spend.

Verified: the proxy logic and the key store by unit tests, and the dialog and flows by a stubbed browser run (`scripts/byok-e2e.mjs`). Not verified: the deployed `muapi-byok` against a real key, muapi's exact balance response (the dialog shows the number it returns as "muapi credits"), and whether muapi calls are accepted from your production domain.

## Deploying the backend (once)

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
   supabase functions deploy health --no-verify-jwt
   supabase functions deploy ops-alerts --no-verify-jwt
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
- **Usage and referrals:** Settings shows credits spent per week and per kind of work (failed generations net out). Referrals pay only from a referred customer's FIRST purchase of at least $10 (default: 300 credits to the referrer, 200 to the friend, 20 rewards per referrer, each reward also capped at 30% of the credits that order granted so a reward can never exceed the sale; reciprocal invites are refused; rewards that could not be taken back after a refund are counted as unrecovered in the admin numbers), are reversed if that order is refunded or disputed, and are controlled in `/admin`. Deploy `supabase functions deploy referral-claim`.
- **Dubbing:** select a hosted video clip, then Clip, Dub. It transcribes once, then for each language (up to 5) translates, speaks in the chosen voice and lip-syncs the original clip, as its own video you add to the timeline. One language failing does not affect the others. Uses Sync Lipsync by default (Pro Pack or Recast). Translation quality, voice support per language and lip-sync on translated audio are unverified until a capped live run: `scripts/live-dub.ts` is a dry run by default (`--run --cap` to spend).

### Captions studio (Phase 12)

Select a shot, then Generate captions. Two modals: **Generate captions** (pick the shot, where to transcribe, model size, language, one of 33 style presets, drag the caption position on a phone preview, watch Load model, Transcribe, Build captions, Done) and **Caption studio** (phone preview with video/black/gradient/light backgrounds and 0.75x to 1.5x speed; Transcript tab with click-to-seek words, inline edit, add/delete word, split and merge lines, 0.1 s timing nudges, find and replace, case conversion, copy, undo and redo, auto-scroll; Motion & Style tab with presets, seven motion engines, font, weight and weight transition, size, outline, position, words per line, colours, language; Export tab with SRT, VTT, TXT, ASS (karaoke tags) and JSON, and burn-in through the normal MP4 export). Apply puts the captions on the timeline; the last five versions are kept per project.

- **Free engines, all in the browser:** Transformers.js Whisper (WebGPU when available, else WebAssembly, in a Web Worker) is tried first; if it cannot run, whisper.cpp (WebAssembly via `@remotion/whisper-web`) is tried. The paid cloud Whisper is only used when the customer picks it. Dictation uses the browser's Web Speech API (no word timings; some browsers send audio to the vendor).
- **whisper.cpp needs a cross-origin isolated page** (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy`). The app does not send these headers by default because they can block cross-origin media; without them the engine reports itself unavailable and is skipped. Transformers.js does not need them.
- Models download once (about 40 to 250 MB) and are cached by the browser. Clips up to 10 minutes. Finished transcripts are cached per clip, engine, model and language.
- Credits: ai-video-captions and Capite (both MIT), see `NOTICE.md`.
- **Verified:** unit tests; real headless exports of all seven motion engines and Japanese, Arabic, Hindi, Hebrew and Korean captions; real on-device transcription of a real generated clip with Transformers.js Whisper-base and whisper.cpp tiny.en (see the change notes). **Not verified:** WebGPU speed, Safari and Firefox, whisper.cpp base and small, Web Speech quality, very long clips.

### Scripture and Motivation packs (Phase 11)

Two paid add-ons, each an extra show in the same subway interview: **Scripture** (Bible Pack) and **Motivation** (Motivation Pack). Apply `20261124000000_faith_motivation_packs.sql` to seed the two products (placeholder prices; edit them in `/admin`). Like Happiness they are display locks: the shows are prompt text, so the lock is not a server-side gate.

- **Verses are exact.** The library (`src/lib/bible/verses.generated.ts`, 416 verses in 14 themes, in King James Version, World English Bible and Berean Standard Bible, all public domain) is built by `scripts/build-verses.mjs`. The core list is hand picked; more verses per theme come from OpenBible.info topic scores (CC BY 4.0, references only, never its ESV text). A verse is kept only when independent sources agree: KJV needs two of wldeh/bible-api, getbible and scrollmapper; WEB needs wldeh and getbible (or bible-api to break a tie, since the sources carry different WEB editions); BSB needs scrollmapper and bible-api.com. Verses with a psalm title in front, or that any source disagrees on, are left out (32 of 448 candidates this time). To rebuild: download `BSB.json` and `KJV.json` from scrollmapper/bible_databases (`formats/json`) and `topic-scores.txt` from openbible.info/topics, then run `NODE_USE_ENV_PROXY=1 VERSE_DATA=<folder> node scripts/build-verses.mjs --drop-mismatches` (about 20 minutes the first time; fetches are cached). Not open and not included: ESV, NIV, NLT, NKJV, NASB, CSB (copyrighted; they need a paid licence). Customers can also type their own verse (labelled "your text", no accuracy claim).
- **The video model may garble spoken words.** The on-screen verse card is always exact. If the verse fits the clip it is spoken first, then the reflection; if not, the guest names the verse and reflects (a spoken verse is never cut short). For word-for-word audio use the Cuts format. Unverified: how well real video models speak a verse; run `scripts/live-interview.ts` with a Scripture take (dry run first) to check.
- **The card changes hands once (real test, 2026-11-20, second Veo 3.1 Fast clip, about $0.60).** The first clip said "Both hold a card, passing it between them": the host asked with the card low, held it out sideways for about two seconds, the guest started talking before taking it, and at 5 to 7 seconds the host was still holding the card while the guest spoke. The Two-shot prompt is now a timed beat sheet with exactly ONE card (host asks with it at their own mouth, hands it across in one movement, guest answers with it; the guest line is sized to the seconds the guest actually gets). In the replay of the new clip (a frame every half second and timed words) the host asks with the card at their mouth for the first 1.5 s, hands it across between 1.5 and 2.5 s, the guest takes it and answers with it for the rest, the host listens with empty hands and laughs at the end, and the guest's whole line was spoken word for word ("Pineapple belongs on pizza and anyone who disagrees is scared of joy.", heard 1.7 to 6.2 s). One clip proves only that clip: the guest began a little before the planned 2.8 s and held the card below the chin at times. The hand-off second also means a Two-shot has even less room for a verse, so Scripture should use Cuts.
- **Real test (2026-11-20, one Veo 3.1 Fast two-shot, about $0.60):** with the line "Proverbs 27 verse 5 says: Open rebuke is better than secret love.", the clip showed two people side by side with a yellow card held as the mic, and cloud Whisper heard only "What verse got you through this week? Proverbs 27, verse 5 says," - the verse itself was not spoken within the 8 seconds. One clip proves little, but do not rely on a Two-shot to read a verse aloud; use Cuts (voice reading) when the spoken words must be exact. The on-device Whisper base model caught only the host's question on the same clip.
- **Guardrails:** the content screen refuses depicting or voicing God, Jesus, prophets and other holy figures, mocking faith, and guarantees of healing or wealth; ordinary faith talk passes. The AI policy has a faith section. All of this is a draft for legal review.

### Finding a verse or a quote

Both libraries use one search dialog (`FindDialog`) and one engine (`src/lib/search/rank.ts`): type a word, a reference (`john 3 16`), an author or book, a theme, or what you are going through (`scared`, `can't sleep`, `I want to quit`; a small synonym list maps everyday words to the words the texts use). Results are ranked best first with the matched words highlighted, theme chips with counts filter them, arrow keys and Enter choose, "Surprise me" picks one. Verses can be shown in KJV, WEB or BSB.

**Quotes** (`src/lib/quotes/quotes.generated.ts`, 85 quotes from 14 authors, built by `scripts/build-quotes.mjs`): every quote is made of the author's own words, found in order in a public-domain book on Project Gutenberg (Marcus Aurelius, Epictetus, Confucius, Lao Tzu, Emerson, Thoreau, Franklin, Twain, William James, Nietzsche, Booker T. Washington, Carlyle, Smiles, James Allen), shown with its author, work and translator. A long sentence may be shortened at a clause break and is never reworded; the build refuses any quote that is not a run of the book's words. Characters' lines (plays, novels, the Prophet, Zarathustra) are excluded. Customers only see public-domain authors; modern names (Maya Angelou, Steve Jobs and so on) are deliberately left out because their words are copyrighted and often misattributed.

How the open lists are used: **hints, never text.** The MIT-licensed `akhiltak/inspirational-quotes` list (76k quotes) only supplies candidate sayings by authors we have books for. Each candidate is matched against that author's own book (a misattributed line such as "Be the change you wish to see" simply never appears in Gandhi's own writing and is dropped), the shipped wording is the book's, and a person reviews every candidate (`LIST_APPROVED` in the script). Also dropped: fragments, questions, sentences where the author quotes someone else, stage directions and speaker labels from plays, text that does not read well on a phone. To add more: add `[book id, theme, hint]` lines or approve more list sentences in the script, download the book text (`https://gutenberg.pglaf.org/<digits>/<id>/<id>-0.txt`), then run `QUOTE_DATA=<folder> QUOTE_DATASET=<akhiltak Quotes.csv> node scripts/build-quotes.mjs` (add `APPROVE_ALL=1` to review every candidate). Not used, with reasons: JamesFT/Database-Quotes-JSON (no licence), dwyl/quotes (GPL-2.0), Quotable (data rights unclear), Wikiquote (CC BY-SA share-alike; could supply hints later). The Marcus Aurelius text on Gutenberg is the 1634 Casaubon translation, so it reads old-fashioned.

### Launch readiness (Phase 10)

- **Content safety:** every generation request is screened for sexual content, minors, graphic violence, self-harm, hate, medical-cure claims and real, named people, in the browser (clear message) AND in the gateway (enforced, before any charge). It is a phrase-and-pattern screen, not a classifier: it stops the obvious and lazily obfuscated, not clever intent. Add your own terms in `/admin` (Operations). The studio's own prompts are tested to pass it.
- **Consent for faces:** Cast portrait uploads and Recast source clips and reference photos are off until the customer agrees that they have the right, the person is an adult and has agreed. The agreement is recorded with the time and wording version (`consents`). It is evidence plus a gate in the page, not a server-side block on uploads.
- **AI label:** exports carry a small "AI-generated" label by default (the customer can turn it off in Output).
- **Legal pages:** `/terms`, `/privacy`, `/refunds`, `/ai-policy` are public and linked from sign-in, sign-up and Settings. They are **drafts that describe what the product does**, with `[bracketed]` decisions for you. Have a lawyer review them before launch. Edit them in `src/lib/legal/documents.ts`.
- **Monitoring:** apply `20261123000000_launch_ops.sql`, deploy `health` and `ops-alerts` (`supabase functions deploy health --no-verify-jwt` and `supabase functions deploy ops-alerts --no-verify-jwt`), and schedule `POST .../ops-alerts` with `x-cron-secret` every 10 minutes. It raises one alert per problem (ledger drift, negative balances, Stripe events needing a human, low muapi balance, stuck holds, high failure rate, refund spikes, browser error spikes), shows them in `/admin`, and optionally posts new ones to a Slack-compatible webhook. Optional secrets: `MUAPI_LOW_BALANCE_USD` (default 20), `ALERT_WEBHOOK_URL`. Point an uptime monitor at the public `health` URL (it returns only `{ok}`).
- **Abuse tests:** `supabase/tests/abuse.sql` audits the whole database from a hostile user's point of view (which functions and tables clients can touch, row-level security everywhere, per-account rate limits under a simulated signup farm). Run it with `scripts/test-credits-sql.sh`; any new table or function that opens a door fails it.

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
