# Live Provider Preflight Harness

`scripts/provider-preflight.mjs` is an operator tool that proves the **live** third
party providers SubwayTakes Studio depends on actually work with the credentials
supplied in the environment — before anyone touches the UI.

**It never fabricates, mocks, or simulates a success.** A provider is only called
when its credential is present; a missing credential is reported `BLOCKED` and
costs nothing; any deviation from the provider contract is a loud `FAIL`. This is
the same "real, not stubbed" philosophy as `scripts/browser-acceptance.mjs`, but
aimed at the network boundary of the edge functions' providers.

- Node 22 ESM, **zero dependencies** (uses global `fetch` + `AbortController`).
- Every request is bounded by an `AbortController` timeout (≈30s per request), so
  the harness can never hang.

## Quick start (operator)

Run when staging keys are available:

```bash
MUAPI_API_KEY=sk-muapi-... OPENAI_API_KEY=sk-... node scripts/provider-preflight.mjs
```

To also exercise the real (credit-spending) veo3 video path and, downstream of it,
the ai-captions path:

```bash
MUAPI_API_KEY=sk-muapi-... OPENAI_API_KEY=sk-... ALLOW_MUAPI_VIDEO_SPEND=1 \
  node scripts/provider-preflight.mjs
```

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | for check 1 | — | OpenAI Responses API key. Without it, check 1 is `BLOCKED`. |
| `MUAPI_API_KEY` | for checks 2–4 | — | MuAPI key (`x-api-key` header). Without it, checks 2–4 are `BLOCKED`. |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | Model for the `plan-interview` schema check. |
| `MUAPI_BASE_URL` | no | `https://api.muapi.ai/api/v1` | MuAPI base URL (trailing slashes trimmed). |
| `ALLOW_MUAPI_VIDEO_SPEND=1` | no | unset | Enables the **real** veo3 generation in check 2 and unlocks check 4. Without it, check 2 runs a no-spend auth+contract probe and check 4 is `BLOCKED`. |
| `PREFLIGHT_AUDIO_URL` | no | built-in candidates | Override the public test-audio sample used by check 3. |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Every check that ran, passed. |
| `1` | At least one check `FAIL`ed. |
| `2` | Every check was `BLOCKED` (e.g. no credentials) — nothing executed. |

The final line is one of `PREFLIGHT RESULT: PASS N/N`, `PREFLIGHT RESULT: FAIL N/M`,
or `PREFLIGHT RESULT: BLOCKED (no credentials)`, where `N/M` is passed/executed
(blocked checks are excluded from `M` and reported separately). A machine-readable
`PREFLIGHT SUMMARY: {…}` JSON is printed last for CI ingestion.

## What each check proves

### Check 1 — `openai_responses` (edge function: `plan-interview`)

POSTs `https://api.openai.com/v1/responses` with the model from `OPENAI_MODEL`
(default `gpt-4o-mini`), a `json_schema` (strict) that is byte-for-byte the same
7-beat schema `plan-interview` uses, the same `interview_plan` schema name, and
the same system prompt. It then replicates `plan-interview`'s own response
extraction (`output_text`, else `output[].content[].text`) and `parsePlan()`
validation.

PASS requires: HTTP 200, parseable output, and a plan that matches the full
`plan-interview` contract — exactly 7 beats with the required `beatId`s **in
order** (`opening_hook`, `interviewer_intro`, `guest_responds`,
`interviewer_challenges`, `guest_expands`, `reaction_moment`,
`closing_statement`), valid `shotType`/`speaker`, and non-empty `title`,
`hookQuestion`, `dialogue`, `cameraDirection`, and `videoPrompt`. Partial output
is never accepted.

### Check 2 — `muapi_veo3_video` (edge functions: `generate-scene` + `scene-status`)

Proves MuAPI video generation end-to-end. It posts to
`$MUAPI_BASE_URL/veo3-text-to-video` with the exact payload `generate-scene`
builds via `muapiVideoRequest("veo3", …)` — `{ prompt, aspect_ratio: "9:16" }`
(veo3 has **no** `duration` field), authenticated with `x-api-key`.

Two paths, and the harness is explicit about which one ran:

- **No-spend auth+contract probe (default).** Gates on `ALLOW_MUAPI_VIDEO_SPEND=1`
  being absent, then submits a deliberately **invalid** body (missing `prompt`).
  - `401`/`403` (or an auth-worded message) → `FAIL` — the credential does not
    authenticate.
  - Any other `4xx` with a provider error message → `PASS` — this proves the key
    authenticates, the endpoint exists, and the endpoint validates the contract.
    The credit-spending generation is reported as `SKIPPED`.
  - A `2xx`/`5xx`/unexpected response → `FAIL`.
- **Real generation (costs credits).** Only when `ALLOW_MUAPI_VIDEO_SPEND=1`. It
  submits the real prompt, polls
  `GET $MUAPI_BASE_URL/predictions/{request_id}/result` every 5s for up to 24
  attempts (≈2 min), printing each status transition. PASS requires a final
  `completed` status, `outputs[0]` being an `https` URL, **and** that URL serving
  genuine video content (`content-type` starts with `video/` and > 10000 bytes).
  `failed`/`cancelled` or a timeout is `FAIL`. The output URL is captured for
  check 4.

### Check 3 — `muapi_openai_whisper` (edge function: `muapi-captions`, editable mode)

Proves MuAPI's Whisper transcription. It picks a **reachable** public test-audio
sample (built-in candidates ordered by "most likely to contain real speech",
starting with OpenAI Whisper's canonical `tests/jfk.flac`; override with
`PREFLIGHT_AUDIO_URL`), then POSTs
`$MUAPI_BASE_URL/openai-whisper` with `{ audio_url, response_format: "vtt",
language: "en" }` — matching `muapi-captions`' editable submit (which maps the
display language through `toWhisperLanguage` → `en`). It polls like check 2 and
extracts the transcript (inline fields, `data:` URLs, `-->`-bearing outputs, or a
downloaded text URL — mirroring `extractTranscriptText`). PASS requires the result
to contain real VTT cue timestamps (`HH:MM:SS.mmm --> HH:MM:SS.mmm`). If no sample
audio URL is reachable, the check is `BLOCKED`.

### Check 4 — `muapi_ai_captions` (edge function: `muapi-captions`, styled mode)

Proves styled AI captions. It reuses the veo3 output URL produced by check 2; if
that URL is not available (i.e. check 2 ran the no-spend probe), the check is
`BLOCKED` and prints that it "requires a generated video from step 2". With a
video URL it POSTs `$MUAPI_BASE_URL/ai-captions` with
`{ video_url, language: "English", theme: "Hormozi_1" }` (both are valid
constants per `MUAPI_CAPTION_LANGUAGES`/`MUAPI_CAPTION_THEMES`), polls, and PASSes
only when completed and the output URL serves genuine video content (same
`content-type`/bytes check as check 2).

### Step 5 — storage/retrieval sanity

Intentionally **not** covered here. Asset download, public-URL resolution, and
project wiring are validated by the edge functions themselves (see
`supabase/functions/tests` and the browser acceptance test), not by live
provider preflight.

## Expected runtime

| Scenario | Rough runtime |
| --- | --- |
| No credentials | Instant — nothing is called (all `BLOCKED`). |
| Keys, default path (no video spend) | ~1 min — OpenAI generation (a few seconds), MuAPI auth probe (instant), Whisper submit+poll of a tiny sample (~10–40s); check 4 `BLOCKED`. |
| Keys + `ALLOW_MUAPI_VIDEO_SPEND=1` | veo3 generation alone is **~1–3 min**; add Whisper and the ai-captions job → up to ~5–8 min total. |

## Cost note

- **Check 2** does **not** spend credits in its default mode — the missing-`prompt`
  probe provokes a `4xx` and never creates a job.
- **Check 2** spends credits only with `ALLOW_MUAPI_VIDEO_SPEND=1` (a real veo3
  generation). That flag is also what unlocks **check 4**, which itself posts a
  real `ai-captions` job (also spends credits). Run the default path first; flip
  the flag deliberately for the full end-to-end video+captions pass.
- **Check 3** posts a real Whisper transcription job whenever a MuAPI key and a
  reachable public audio sample are both present. It is intentionally *not* gated,
  but the sample is tiny, so the cost is negligible.

## Edge-function → check mapping

| Edge function | Validated by check(s) | What the check proves about it |
| --- | --- | --- |
| `plan-interview` | **1** `openai_responses` | The OpenAI Responses `json_schema` (strict) call and the exact 7-beat ordered schema / `parsePlan()` contract succeed live. |
| `generate-scene` | **2** `muapi_veo3_video` (submit) | The `veo3-text-to-video` submit (URL, `x-api-key`, `{prompt, aspect_ratio}` payload) authenticates and returns a usable `request_id`. |
| `scene-status` | **2** `muapi_veo3_video` (poll + download) | `GET /predictions/{id}/result` reaches `completed`, yields an `https` `outputs[0]`, and that URL serves real video bytes. |
| `muapi-captions` (styled) | **4** `muapi_ai_captions` | The `ai-captions` submit (`{video_url, language, theme}`) + poll + output video is genuinely video content. |
| `muapi-captions` (editable) | **3** `muapi_openai_whisper` | The `openai-whisper` submit (`{audio_url, response_format:"vtt", language:"en"}`) + poll returns a transcript with real VTT cue timestamps. |
| `render-project`, storage/retrieval | — (by design) | Not a live-provider concern; covered by edge-function tests and the browser acceptance test. |

## Safety guarantees

- **No provider is ever called without its credential.**
- **No success is ever synthesized.** Every `PASS` is backed by a live 2xx that was
  then re-validated against the provider's own output.
- API keys are never printed; all requests are bounded by ≈30s `AbortController`
  timeouts, and invalid-credential runs fail in about a second.
