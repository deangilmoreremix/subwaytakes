/*
  # Cast voices + media bucket

  1. character_bibles gains a portrait and a voice (provider, voice id, speed) so a character can speak.
     Existing owner-only RLS (20260226110220_rls_policies.sql) already covers the table; no policy change.
  2. `media` storage bucket for user uploads: portraits, padded voice audio, copies of generated clips.
     Public read (URLs are handed to muapi and the web renderer); writes limited to the owner's own folder.
*/
ALTER TABLE character_bibles
  ADD COLUMN IF NOT EXISTS portrait_url text,
  ADD COLUMN IF NOT EXISTS voice_provider text,
  ADD COLUMN IF NOT EXISTS voice_id text,
  ADD COLUMN IF NOT EXISTS voice_speed numeric NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'character_bibles_voice_provider_check') THEN
    ALTER TABLE character_bibles
      ADD CONSTRAINT character_bibles_voice_provider_check CHECK (voice_provider IS NULL OR voice_provider IN ('elevenlabs', 'minimax'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'character_bibles_voice_speed_check') THEN
    ALTER TABLE character_bibles
      ADD CONSTRAINT character_bibles_voice_speed_check CHECK (voice_speed >= 0.5 AND voice_speed <= 2);
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, 104857600, ARRAY['image/*', 'audio/*', 'video/*'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
CREATE POLICY "media_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'media');

DROP POLICY IF EXISTS "media_owner_insert" ON storage.objects;
CREATE POLICY "media_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "media_owner_update" ON storage.objects;
CREATE POLICY "media_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "media_owner_delete" ON storage.objects;
CREATE POLICY "media_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
