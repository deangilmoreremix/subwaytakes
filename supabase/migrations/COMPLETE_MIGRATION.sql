-- ============================================
-- COMPLETE SUPABASE MIGRATION SCRIPT
-- SubwayTakes Platform - All migrations combined
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- MIGRATION 1: Create Clips Table (2026-01-27)
-- ============================================

CREATE TABLE IF NOT EXISTS clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  clip_type TEXT NOT NULL DEFAULT 'wisdom_interview',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb,
  prompt_used TEXT,
  model_tier TEXT DEFAULT 'standard',
  speech_enabled BOOLEAN DEFAULT false,
  speech_model TEXT,
  character_preset TEXT,
  camera_style TEXT,
  energy_level TEXT,
  topic TEXT,
  age_group TEXT DEFAULT 'adults',
  duration_seconds INTEGER,
  viral_score INTEGER
);

CREATE INDEX idx_clips_user_id ON clips(user_id);
CREATE INDEX idx_clips_clip_type ON clips(clip_type);
CREATE INDEX idx_clips_status ON clips(status);
CREATE INDEX idx_clips_created_at ON clips(created_at DESC);

ALTER TABLE clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clips"
  ON clips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clips"
  ON clips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clips"
  ON clips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view published clips"
  ON clips FOR SELECT
  USING (status = 'published');

-- ============================================
-- MIGRATION 2: Add Subway Enhancements (2026-01-27)
-- ============================================

ALTER TABLE clips ADD COLUMN IF NOT EXISTS subway_line TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS subway_enhancements JSONB;

COMMENT ON COLUMN clips.subway_line IS 'NYC Subway line (1, 2, 3, 4, 5, 6, 7, A, C, E, B, D, F, M, N, Q, R, W, G, J, Z, L, S, any)';

COMMENT ON COLUMN clips.subway_enhancements IS 'JSON object containing subway enhancement configurations';

CREATE INDEX IF NOT EXISTS idx_clips_subway_line ON clips(subway_line) WHERE subway_line IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clips_subway_enhancements ON clips(subway_enhancements) WHERE subway_enhancements IS NOT NULL;

-- ============================================
-- MIGRATION 3: Add Model Tier & Speech Support (2026-01-27)
-- ============================================

ALTER TABLE clips ADD COLUMN IF NOT EXISTS model_tier TEXT DEFAULT 'standard';
ALTER TABLE clips ADD COLUMN IF NOT EXISTS speech_enabled BOOLEAN DEFAULT false;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS speech_model TEXT;

COMMENT ON COLUMN clips.model_tier IS 'AI model tier: free, standard, premium, ultra';
COMMENT ON COLUMN clips.speech_enabled IS 'Enable speech output for the clip';
COMMENT ON COLUMN clips.speech_model IS 'Speech synthesis model to use';

-- ============================================
-- MIGRATION 4: Create Episode System (2026-01-27)
-- ============================================

CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  episode_type TEXT DEFAULT 'standard',
  clip_order UUID[] DEFAULT '{}'::uuid[],
  status TEXT DEFAULT 'draft',
  total_duration INTEGER,
  viral_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_episodes_user_id ON episodes(user_id);
CREATE INDEX idx_episodes_status ON episodes(status);

ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own episodes"
  ON episodes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own episodes"
  ON episodes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own episodes"
  ON episodes FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- MIGRATION 5: Add Enhanced Clip Options (2026-01-28)
-- ============================================

ALTER TABLE clips ADD COLUMN IF NOT EXISTS character_preset TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS camera_style TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS energy_level TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS age_group TEXT DEFAULT 'adults';

COMMENT ON COLUMN clips.character_preset IS 'Character preset for interview subjects';
COMMENT ON COLUMN clips.camera_style IS 'Camera angle and movement style';
COMMENT ON COLUMN clips.energy_level IS 'Interview energy level: calm, moderate, high_energy';
COMMENT ON COLUMN clips.topic IS 'Primary topic of the clip';
COMMENT ON COLUMN clips.age_group IS 'Target age demographic';

-- ============================================
-- MIGRATION 6: Add Interviewer/Subject Characters (2026-01-28)
-- ============================================

ALTER TABLE clips ADD COLUMN IF NOT EXISTS interviewer_id UUID;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS subject_id UUID;

CREATE INDEX IF NOT EXISTS idx_clips_interviewer ON clips(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_clips_subject ON clips(subject_id);

-- ============================================
-- MIGRATION 7: User Profiles & Storage (2026-01-28)
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  asset_type TEXT CHECK (asset_type IN ('image', 'audio', 'video', 'subtitle')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_assets_user ON media_assets(user_id);
CREATE INDEX idx_media_assets_type ON media_assets(asset_type);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view own media"
  ON media_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upload media"
  ON media_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- MIGRATION 8: Enhancement Features (2026-01-31)
-- ============================================

CREATE TABLE IF NOT EXISTS token_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  monthly_tokens INTEGER DEFAULT 0,
  purchased_tokens INTEGER DEFAULT 0,
  used_this_month INTEGER DEFAULT 0,
  last_reset_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT CHECK (type IN ('monthly_allocation', 'purchase', 'usage', 'refund')),
  amount INTEGER NOT NULL,
  description TEXT,
  clip_id UUID REFERENCES clips(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS viral_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID REFERENCES clips(id),
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  hook_strength INTEGER CHECK (hook_strength BETWEEN 0 AND 100),
  emotional_arc INTEGER CHECK (emotional_arc BETWEEN 0 AND 100),
  shareability INTEGER CHECK (shareability BETWEEN 0 AND 100),
  replay_value INTEGER CHECK (replay_value BETWEEN 0 AND 100),
  comment_bait INTEGER CHECK (comment_bait BETWEEN 0 AND 100),
  suggestions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clip_rerolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_clip_id UUID REFERENCES clips(id),
  child_clip_id UUID REFERENCES clips(id),
  intensity TEXT CHECK (intensity IN ('mild', 'medium', 'spicy', 'nuclear')),
  token_cost INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS episode_beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  type TEXT CHECK (type IN ('take', 'reaction', 'discussion')),
  speaker TEXT CHECK (speaker IN ('host', 'guest')),
  content TEXT NOT NULL,
  duration INTEGER,
  emotional_tone TEXT,
  camera_direction TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tier TEXT CHECK (tier IN ('free', 'creator', 'pro', 'studio')),
  status TEXT CHECK (status IN ('active', 'cancelled', 'past_due')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to clips if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'interview_mode') THEN
    ALTER TABLE clips ADD COLUMN interview_mode TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'studio_setup') THEN
    ALTER TABLE clips ADD COLUMN studio_setup TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'studio_lighting') THEN
    ALTER TABLE clips ADD COLUMN studio_lighting TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'guest_count') THEN
    ALTER TABLE clips ADD COLUMN guest_count INTEGER DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'reroll_count') THEN
    ALTER TABLE clips ADD COLUMN reroll_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'parent_clip_id') THEN
    ALTER TABLE clips ADD COLUMN parent_clip_id UUID REFERENCES clips(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clips' AND column_name = 'token_cost') THEN
    ALTER TABLE clips ADD COLUMN token_cost INTEGER;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_viral_scores_clip_id ON viral_scores(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_rerolls_parent ON clip_rerolls(parent_clip_id);
CREATE INDEX IF NOT EXISTS idx_episode_beats_episode ON episode_beats(episode_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON token_transactions(user_id);

ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_rerolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Token policies
CREATE POLICY "Users can view own token balance" ON token_balances FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own token balance" ON token_balances FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can view own transactions" ON token_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view viral scores for their clips" ON viral_scores FOR SELECT 
  USING (clip_id IN (SELECT id FROM clips WHERE user_id = auth.uid()));
CREATE POLICY "Users can view rerolls for their clips" ON clip_rerolls FOR SELECT 
  USING (parent_clip_id IN (SELECT id FROM clips WHERE user_id = auth.uid()));
CREATE POLICY "Users can view beats for their episodes" ON episode_beats FOR SELECT 
  USING (episode_id IN (SELECT id FROM episodes WHERE user_id = auth.uid()));
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- MIGRATION 9: Subway Enhancements (2026-01-31)
-- ============================================

ALTER TABLE clips ADD COLUMN IF NOT EXISTS subway_line TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS subway_enhancements JSONB;

COMMENT ON COLUMN clips.subway_line IS 'NYC Subway line identifier';
COMMENT ON COLUMN clips.subway_enhancements IS 'JSON configuration for subway enhancements';

CREATE INDEX IF NOT EXISTS idx_clips_subway_line ON clips(subway_line) WHERE subway_line IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clips_subway_enhancements ON clips(subway_enhancements) WHERE subway_enhancements IS NOT NULL;

-- ============================================
-- MIGRATION 10: Street & Motivational (2026-01-31)
-- ============================================

ALTER TABLE clips ADD COLUMN IF NOT EXISTS street_enhancements JSONB;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS motivational_enhancements JSONB;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS speaker_archetype TEXT;

CREATE INDEX IF NOT EXISTS idx_clips_street_enhancements ON clips USING GIN (street_enhancements);
CREATE INDEX IF NOT EXISTS idx_clips_motivational_enhancements ON clips USING GIN (motivational_enhancements);
CREATE INDEX IF NOT EXISTS idx_clips_neighborhood ON clips(neighborhood);
CREATE INDEX IF NOT EXISTS idx_clips_speaker_archetype ON clips(speaker_archetype);

COMMENT ON COLUMN clips.street_enhancements IS 'Street interview enhancement configurations';
COMMENT ON COLUMN clips.neighborhood IS 'NYC neighborhood for street content';
COMMENT ON COLUMN clips.motivational_enhancements IS 'Motivational clip enhancement configurations';
COMMENT ON COLUMN clips.speaker_archetype IS 'Speaker style archetype';

-- ============================================
-- MIGRATION 11: Age-Appropriate Content (2026-02-03)
-- ============================================

ALTER TABLE clips ADD COLUMN IF NOT EXISTS target_age_group TEXT DEFAULT 'all_ages' 
  CHECK (target_age_group IN ('kids', 'teens', 'young_adults', 'adults', 'all_ages'));

CREATE TABLE IF NOT EXISTS age_appropriate_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  age_groups TEXT[] NOT NULL DEFAULT ARRAY['teens', 'young_adults', 'adults']::TEXT[],
  content_rating TEXT NOT NULL DEFAULT 'PG' CHECK (content_rating IN ('G', 'PG', 'PG-13', 'R')),
  is_trending BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topic_age_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  category TEXT NOT NULL,
  age_groups TEXT[] NOT NULL DEFAULT ARRAY['teens', 'young_adults', 'adults']::TEXT[],
  content_rating TEXT NOT NULL DEFAULT 'PG' CHECK (content_rating IN ('G', 'PG', 'PG-13', 'R')),
  requires_parental_guidance BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic, category)
);

CREATE TABLE IF NOT EXISTS mature_word_filter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  severity TEXT NOT NULL DEFAULT 'mild' CHECK (severity IN ('mild', 'moderate', 'severe')),
  blocked_for_age_groups TEXT[] NOT NULL DEFAULT ARRAY['kids', 'teens']::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_age_appropriate_questions_age_groups ON age_appropriate_questions USING GIN (age_groups);
CREATE INDEX IF NOT EXISTS idx_age_appropriate_questions_category ON age_appropriate_questions(category);
CREATE INDEX IF NOT EXISTS idx_topic_age_mappings_topic ON topic_age_mappings(topic);
CREATE INDEX IF NOT EXISTS idx_clips_target_age_group ON clips(target_age_group);

-- Insert mature word filter entries
INSERT INTO mature_word_filter (word, severity, blocked_for_age_groups) VALUES
  ('sex', 'severe', ARRAY['kids', 'teens']::TEXT[]),
  ('sexual', 'severe', ARRAY['kids', 'teens']::TEXT[]),
  ('fuck', 'severe', ARRAY['kids', 'teens', 'young_adults']::TEXT[]),
  ('shit', 'moderate', ARRAY['kids']::TEXT[]),
  ('ass', 'moderate', ARRAY['kids', 'teens']::TEXT[]),
  ('bitch', 'moderate', ARRAY['kids', 'teens']::TEXT[]),
  ('damn', 'mild', ARRAY['kids']::TEXT[]),
  ('hell', 'mild', ARRAY['kids']::TEXT[]),
  ('drunk', 'mild', ARRAY['kids']::TEXT[]),
  ('weed', 'mild', ARRAY['kids', 'teens']::TEXT[]),
  ('drugs', 'moderate', ARRAY['kids', 'teens']::TEXT[]),
  ('nude', 'severe', ARRAY['kids', 'teens', 'young_adults']::TEXT[]),
  ('naked', 'moderate', ARRAY['kids', 'teens']::TEXT[])
ON CONFLICT (word) DO NOTHING;

-- Insert topic age mappings
INSERT INTO topic_age_mappings (topic, category, age_groups, content_rating, requires_parental_guidance) VALUES
  ('Learning', 'educational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('School', 'educational', ARRAY['kids', 'teens', 'young_adults', 'all_ages']::TEXT[], 'G', false),
  ('Friends', 'personal', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Family', 'personal', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Hobbies', 'lifestyle', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Animals', 'educational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Science', 'educational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Discipline', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Confidence', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Focus', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Kindness', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Teamwork', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Dreams', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Imagination', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Social Media', 'trending', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
  ('Dating', 'personal', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG-13', true),
  ('College', 'educational', ARRAY['teens', 'young_adults']::TEXT[], 'PG', false),
  ('Mental Health', 'wellness', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
  ('Career', 'professional', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
  ('Money', 'financial', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
  ('Housing', 'lifestyle', ARRAY['young_adults', 'adults']::TEXT[], 'PG', false),
  ('Finance', 'financial', ARRAY['young_adults', 'adults']::TEXT[], 'PG', false),
  ('Entrepreneurship', 'professional', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
  ('Side Hustles', 'professional', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
  ('Work From Home', 'lifestyle', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
  ('NYC Rent', 'lifestyle', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
  ('Politics', 'current_events', ARRAY['young_adults', 'adults']::TEXT[], 'PG-13', true),
  ('Real Estate', 'financial', ARRAY['young_adults', 'adults']::TEXT[], 'PG', false),
  ('Parenting', 'personal', ARRAY['young_adults', 'adults']::TEXT[], 'PG', false),
  ('Work-Life Balance', 'wellness', ARRAY['young_adults', 'adults']::TEXT[], 'PG', false),
  ('Health', 'wellness', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
  ('Success', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Mindset', 'motivational', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'PG', false),
  ('Relationships', 'personal', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'PG-13', true),
  ('Life Advice', 'motivational', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'PG', false),
  ('Philosophy', 'educational', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'PG', false),
  ('Hot Takes', 'trending', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG-13', true),
  ('Personal', 'personal', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG-13', true),
  ('Failure', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Motivation', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Inspiration', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Leadership', 'motivational', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'PG', false),
  ('Comeback', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Purpose', 'motivational', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'PG', false),
  ('Sports', 'lifestyle', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Food Takes', 'trending', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'PG', false),
  ('Hydration Myths', 'trending', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Coffee Culture', 'lifestyle', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'PG', false),
  ('Sleep Schedules', 'wellness', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'PG', false),
  ('Transportation', 'lifestyle', ARRAY['teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
  ('Winter vs Summer', 'trending', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false)
ON CONFLICT (topic, category) DO NOTHING;

ALTER TABLE age_appropriate_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_age_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mature_word_filter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to age_appropriate_questions" ON age_appropriate_questions FOR SELECT USING (true);
CREATE POLICY "Allow public read access to topic_age_mappings" ON topic_age_mappings FOR SELECT USING (true);
CREATE POLICY "Allow public read access to mature_word_filter" ON mature_word_filter FOR SELECT USING (true);

COMMENT ON COLUMN clips.target_age_group IS 'Target age group for content appropriateness';
COMMENT ON TABLE age_appropriate_questions IS 'Questions with age appropriateness metadata';
COMMENT ON TABLE topic_age_mappings IS 'Topic to age group mappings for content filtering';
COMMENT ON TABLE mature_word_filter IS 'Mature words list for content filtering';

-- ============================================
-- MIGRATION 12: Update Age Groups (2026-02-03)
-- ============================================

-- Drop existing enum type and create new one with older_adults instead of young_adults
DROP TYPE IF EXISTS age_group CASCADE;

CREATE TYPE age_group AS ENUM ('kids', 'teens', 'adults', 'older_adults', 'all_ages');

-- Update clips table
ALTER TABLE clips ALTER COLUMN target_age_group TYPE age_group;
ALTER TABLE clips ALTER COLUMN target_age_group SET DEFAULT 'all_ages'::age_group;

-- Update any existing records
UPDATE clips SET target_age_group = 'older_adults'::age_group WHERE target_age_group = 'young_adults';

CREATE INDEX IF NOT EXISTS idx_clips_target_age_group ON clips(target_age_group);

-- ============================================
-- COMPLETE: All migrations applied
-- ============================================

-- Verify tables exist
SELECT 'clips' as table_name, count(*) as row_count FROM clips
UNION ALL
SELECT 'episodes', count(*) FROM episodes
UNION ALL
SELECT 'profiles', count(*) FROM profiles
UNION ALL
SELECT 'token_balances', count(*) FROM token_balances
UNION ALL
SELECT 'viral_scores', count(*) FROM viral_scores
UNION ALL
SELECT 'topic_age_mappings', count(*) FROM topic_age_mappings
UNION ALL
SELECT 'mature_word_filter', count(*) FROM mature_word_filter;
