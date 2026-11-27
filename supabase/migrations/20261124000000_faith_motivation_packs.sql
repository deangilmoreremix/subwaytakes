-- Phase 11: two paid add-on packs, the Bible Pack (Scripture show) and the Motivation Pack.
-- Only seeds editable catalogue rows. Prices and credits are PLACEHOLDERS: set them in /admin before launch.
-- The unlock is a display lock in the app (the shows are prompt text, not metered models), exactly like the Happiness show.
-- Safe to re-run: existing rows (and any price you have edited) are left alone.

INSERT INTO products (key, kind, name, description, price_cents, credits, entitlements, sort, active) VALUES
  ('bible_pack',      'bundle', 'Bible Pack',      'The Scripture show: public-domain KJV and WEB verses with an exact on-screen verse card, in the same subway interview.', 2700, 300, '{bible}', 80, true),
  ('motivation_pack', 'bundle', 'Motivation Pack', 'The Motivation show: fired-up, calm and tough-love advice with a bold quote card, in the same subway interview.',      2700, 300, '{motivation}', 90, true)
ON CONFLICT (key) DO NOTHING;
