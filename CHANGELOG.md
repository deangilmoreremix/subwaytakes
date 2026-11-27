# Changelog

## [1.0.0]

A ground-up rebuild around muapi and the real SubwayTakes interview format.

### Added
- Create: Place panel (25 cities, each with its own transit card, real stations and local look; scenes, time of day, crowd, ambience, street mode), interview formats (Two-shot, Cuts, Solo), Ideas picker, on-screen take title with badge and guest sticker.
- Two-shot host from Cast: a portrait host gets a starting image of host and guest, then image-to-video.
- Cast: characters with portrait (upload or generate) and ElevenLabs or MiniMax voice.
- Recast: replace the performer in a clip; optional new voice with lip-sync; staged and resumable.
- Timeline editor on `@remotion/player` with captions, transitions, sound effects and light leaks; browser export with `@remotion/web-renderer`.
- CI workflow, README, CLAUDE.md.

### Removed
- All legacy create flows, episode, compilation, template, analytics and dashboard pages, the old prompt engines, the old Remotion server project, the old video edge functions (`generate-video`, `stitch-*`, `process-video`, `compose-overlay`, `build-prompt`, `generate-script`, `secure-clips-api`), the thumbnail service, Docker files and stale assets. Existing database rows are untouched.

### Fixed
- Signed-out visitors are redirected to `/login` (the route guard used to do nothing).
- The transit card follows the city (it was hard-coded to MetroCard).
