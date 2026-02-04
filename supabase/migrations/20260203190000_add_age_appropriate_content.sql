-- Age-Appropriate Content Control Schema
-- Migration for SubwayTakes age-appropriate content controls

-- Add target_age_group column to clips table
ALTER TABLE clips ADD COLUMN IF NOT EXISTS target_age_group TEXT DEFAULT 'all_ages' CHECK (target_age_group IN ('kids', 'teens', 'young_adults', 'adults', 'all_ages'));

-- Create age_appropriate_questions table for storing questions with age ratings
CREATE TABLE IF NOT EXISTS age_appropriate_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    age_groups TEXT[] NOT NULL DEFAULT ARRAY['teens', 'young_adults', 'adults']::TEXT[],
    content_rating TEXT NOT NULL DEFAULT 'PG' CHECK (content_rating IN ('G', 'PG', 'PG-13', 'R')),
    is_trending BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create topic_age_mappings table for topic age appropriateness
CREATE TABLE IF NOT EXISTS topic_age_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    category TEXT NOT NULL,
    age_groups TEXT[] NOT NULL DEFAULT ARRAY['teens', 'young_adults', 'adults']::TEXT[],
    content_rating TEXT NOT NULL DEFAULT 'PG' CHECK (content_rating IN ('G', 'PG', 'PG-13', 'R')),
    requires_parental_guidance BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(topic, category)
);

-- Create mature_word_filter table for content filtering
CREATE TABLE IF NOT EXISTS mature_word_filter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT NOT NULL UNIQUE,
    severity TEXT NOT NULL DEFAULT 'mild' CHECK (severity IN ('mild', 'moderate', 'severe')),
    blocked_for_age_groups TEXT[] NOT NULL DEFAULT ARRAY['kids', 'teens']::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster age-based queries
CREATE INDEX IF NOT EXISTS idx_age_appropriate_questions_age_groups ON age_appropriate_questions USING GIN (age_groups);
CREATE INDEX IF NOT EXISTS idx_age_appropriate_questions_category ON age_appropriate_questions (category);
CREATE INDEX IF NOT EXISTS idx_topic_age_mappings_topic ON topic_age_mappings (topic);
CREATE INDEX IF NOT EXISTS idx_clips_target_age_group ON clips (target_age_group);

-- Insert default mature word filter entries
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

-- Insert default topic age mappings
INSERT INTO topic_age_mappings (topic, category, age_groups, content_rating, requires_parental_guidance) VALUES
    -- Educational/Family topics - all ages
    ('Learning', 'educational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('School', 'educational', ARRAY['kids', 'teens', 'young_adults', 'all_ages']::TEXT[], 'G', false),
    ('Friends', 'personal', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('Family', 'personal', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('Hobbies', 'lifestyle', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('Animals', 'educational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('Science', 'educational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    
    -- Motivational - all ages
    ('Discipline', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('Confidence', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('Focus', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('Kindness', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('Teamwork', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('Dreams', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    ('Imagination', 'motivational', ARRAY['kids', 'teens', 'young_adults', 'adults', 'all_ages']::TEXT[], 'G', false),
    
    -- Teen-specific
    ('Social Media', 'trending', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
    ('Dating', 'personal', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG-13', true),
    ('College', 'educational', ARRAY['teens', 'young_adults']::TEXT[], 'PG', false),
    ('Mental Health', 'wellness', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
    
    -- Young adult topics
    ('Career', 'professional', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
    ('Money', 'financial', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
    ('Housing', 'lifestyle', ARRAY['young_adults', 'adults']::TEXT[], 'PG', false),
    ('Finance', 'financial', ARRAY['young_adults', 'adults']::TEXT[], 'PG', false),
    ('Entrepreneurship', 'professional', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
    ('Side Hustles', 'professional', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
    ('Work From Home', 'lifestyle', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
    ('NYC Rent', 'lifestyle', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
    
    -- Adult topics (18+)
    ('Politics', 'current_events', ARRAY['young_adults', 'adults']::TEXT[], 'PG-13', true),
    ('Real Estate', 'financial', ARRAY['young_adults', 'adults']::TEXT[], 'PG', false),
    ('Parenting', 'personal', ARRAY['young_adults', 'adults']::TEXT[], 'PG', false),
    ('Work-Life Balance', 'wellness', ARRAY['young_adults', 'adults']::TEXT[], 'PG', false),
    ('Health', 'wellness', ARRAY['teens', 'young_adults', 'adults']::TEXT[], 'PG', false),
    
    -- Universal
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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_age_appropriate_questions_updated_at ON age_appropriate_questions;
CREATE TRIGGER update_age_appropriate_questions_updated_at
    BEFORE UPDATE ON age_appropriate_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_topic_age_mappings_updated_at ON topic_age_mappings;
CREATE TRIGGER update_topic_age_mappings_updated_at
    BEFORE UPDATE ON topic_age_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies for age-appropriate tables
ALTER TABLE age_appropriate_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_age_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mature_word_filter ENABLE ROW LEVEL SECURITY;

-- Allow public read access to lookup tables
CREATE POLICY \"Allow public read access to age_appropriate_questions\" 
    ON age_appropriate_questions FOR SELECT 
    USING (true);

CREATE POLICY \"Allow public read access to topic_age_mappings\" 
    ON topic_age_mappings FOR SELECT 
    USING (true);

CREATE POLICY \"Allow public read access to mature_word_filter\" 
    ON mature_word_filter FOR SELECT 
    USING (true);

-- Comments for documentation
COMMENT ON COLUMN clips.target_age_group IS 'Target age group for content appropriateness (kids, teens, young_adults, adults, all_ages)';
COMMENT ON TABLE age_appropriate_questions IS 'Questions with age appropriateness metadata for content filtering';
COMMENT ON TABLE topic_age_mappings IS 'Topic to age group mappings for content filtering';
COMMENT ON TABLE mature_word_filter IS 'Mature words list for content filtering by age group';
