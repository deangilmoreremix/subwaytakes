/*
  # Seed music tracks and sound effects

  1. Data Seeded
    - `music_tracks`: 8 system music tracks across different moods
      - Includes energetic, calm, dramatic, inspiring, cinematic, playful, tense, and neutral tracks
    - `sound_effects`: 7 system sound effects across different categories
      - Includes subway, street, studio, motivational, wisdom, transition, and stinger effects

  2. Notes
    - All entries marked as `is_system = true` (system-provided, not user-created)
    - URLs are placeholder paths to be replaced with actual audio file URLs when available
    - Durations and BPM are representative defaults for each mood/category
*/

INSERT INTO music_tracks (name, url, mood, duration_seconds, bpm, is_system)
VALUES
  ('Urban Pulse', '/audio/tracks/urban-pulse.mp3', 'energetic', 30, 128, true),
  ('Quiet Reflections', '/audio/tracks/quiet-reflections.mp3', 'calm', 45, 72, true),
  ('Rising Tension', '/audio/tracks/rising-tension.mp3', 'dramatic', 30, 100, true),
  ('Golden Hour', '/audio/tracks/golden-hour.mp3', 'inspiring', 30, 96, true),
  ('Night Drive', '/audio/tracks/night-drive.mp3', 'cinematic', 45, 85, true),
  ('Street Vibes', '/audio/tracks/street-vibes.mp3', 'playful', 30, 110, true),
  ('On Edge', '/audio/tracks/on-edge.mp3', 'tense', 30, 90, true),
  ('Everyday Flow', '/audio/tracks/everyday-flow.mp3', 'neutral', 30, 95, true)
ON CONFLICT DO NOTHING;

INSERT INTO sound_effects (name, url, category, duration_seconds, is_system)
VALUES
  ('Train Arriving', '/audio/sfx/train-arriving.mp3', 'subway', 4, true),
  ('City Ambience', '/audio/sfx/city-ambience.mp3', 'street', 5, true),
  ('Studio Intro Chime', '/audio/sfx/studio-chime.mp3', 'studio', 2, true),
  ('Motivational Rise', '/audio/sfx/motivational-rise.mp3', 'motivational', 3, true),
  ('Gentle Transition', '/audio/sfx/gentle-transition.mp3', 'wisdom', 2, true),
  ('Whoosh Transition', '/audio/sfx/whoosh.mp3', 'transition', 1, true),
  ('Impact Stinger', '/audio/sfx/impact-stinger.mp3', 'stinger', 2, true)
ON CONFLICT DO NOTHING;
