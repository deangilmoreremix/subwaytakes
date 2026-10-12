# Acceptance Failure Matrix

Every failure scenario the application must survive, the check that proves it,
and its current result. All browser checks are tagged **[STUBBED-BACKEND]**:
the app code, the browser, the render pipeline and the timeline editor are
real; only the Supabase/MuAPI/OpenAI network boundary is stubbed locally
because no live credentials exist in this environment.

**Suite:** `node scripts/browser-acceptance.mjs` (production build, real Chrome
headless shell, real MP4 sources). **Total: 95/95 checks PASS** —
W1 54 · W2 13 · W3 11 · W4 17 · F1–F11 28... (see per-scenario rows).

## User journey (happy path)

| Step | Check | Result | Evidence |
|---|---|---|---|
| Open app / anonymous session | app shell renders, auth session established | PASS | `01-dashboard.png` |
| Create an interview (topic) | plan-interview called, project created, redirect to editor | PASS | `02-studio-new-topic.png` |
| Seven interview beats | timeline renders 5 tracks, 7 beat clips | PASS | `03-editor-overview.png` |
| Generate AI scenes | MuAPI submit + poll, clip asset wired with canonical ref | PASS | `08-scene-generated.png` |
| Open scenes in the editor | player mounts the composition, captions render | PASS | `04-editor-player.png` |
| Upload footage | real file → private storage → signed URL → clip on timeline | PASS | `10-upload-topic.png`, `11-upload-clip-on-timeline.png` |
| Trim / split / reorder / drag | trim slider, split, undo/redo, drag changes position | PASS | `05-clip-inspector.png`, `06-after-edit.png` |
| Captions + branding | caption edit + autosave PATCH, branding watermark renders | PASS | `07-captions.png` |
| Save the project | autosave persists project JSON with refs | PASS | summary: 4 PATCHes observed |
| Reopen the project | project reload restores all tracks/captions/branding | PASS | W3 `13-media-recovered-preview.png` |
| Render the video | render-project enqueued, job queued → done | PASS | `09-export-done.png` |
| Download the MP4 | download link serves a real `video/mp4` (631 KB) | PASS | real bytes served through the export UI |

## Failure scenarios

| # | Scenario | Check | Result | Evidence |
|---|---|---|---|---|
| F1 | Missing provider key | plan-interview 500 → visible error, no project created, no editor redirect | PASS ×3 | `17-f1-missing-provider-key.png` |
| F2 | Provider failure mid-generation | provider message shown verbatim; no storage upload (no fabricated asset) | PASS ×3 | `18-f2-provider-failure.png` |
| F3 | Malformed provider output (6 beats) | server rejects with 500; error shown; no project | PASS ×2 | `19-f3-malformed-plan.png` |
| F4 | Invalid upload (non-video) | error surfaced; no clip added to the timeline | PASS ×3 | `20-f4-invalid-upload.png` |
| F5 | Cross-user access | render 404, media-sign 404 (no URL), job invisible; B can still render its own project | PASS ×4 | `21-f5-cross-user.png` |
| F6 | Failed render | error shown; no download link | PASS ×2 | `22-f-failed-render` (`22-f-failed-render.png` where captured) |
| F7 | Interrupted/stale job | job stuck running with a stale heartbeat (never done); no premature download | PASS ×3 | `23-f7-interrupted-job.png` |
| F8 | Expired media + signing failure | player keeps a usable URL, warning surfaced, never blank | PASS ×3 | `24-f8-media-sign-failure.png` |
| F9 | Mobile 390×844 | no horizontal overflow | PASS | `25-f9-mobile.png` |
| F9 | Desktop 1600×1200 | no horizontal overflow | PASS | `25-f9-desktop.png` |
| F10 | Console errors | no unexpected pageerror/console.error across all failure scenarios | PASS | run log |
| F11 | Transient REST 500 | in-memory project state preserved (typed title survives the failed autosave) | PASS ×2 | `26-f11-network-failure.png` |

## Security scenarios

| Scenario | Check | Result | Evidence |
|---|---|---|---|
| Cross-user project read | user B sees nothing of user A's project (0 rows, "access denied") | PASS | W4 |
| Cross-user signing | user B cannot sign user A's object (404, no URL fabricated) | PASS | W4 |
| Cross-user render | user B's render enqueue for user A's project is 404 | PASS | W4/F5 |
| media-sign hardening | unlisted bucket 400, traversal 400, absolute path 400, service-role bearer 401 | PASS | W4 + deno tests |
| Render output identity | the worker persists a canonical `output_ref` + signed URL, guarded against reclaimed rows | PASS | worker tests |
| Private buckets | `studio-uploads` / `studio-exports` are private; reads require a signed URL | PASS | migration + tests |

## Known follow-up (not a failure, recorded for the owner)

- The shared `videos` bucket visibility is a live-deployment unknown; the
  Studio signs uid-scoped paths for every read, so a private bucket works by
  construction. The live bucket flags are verified by the read-only audit kit
  before the migration is applied.
