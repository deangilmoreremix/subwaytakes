-- Migration: Update Age Groups from young_adults to older_adults
-- This migration replaces the young_adults age group with older_adults (45+)

-- 1. Update enum type for age_group
-- First, we need to drop and recreate the enum type since PostgreSQL doesn't support renaming values directly

-- Drop the existing enum type if it exists
DROP TYPE IF EXISTS age_group CASCADE;

-- Create new enum type with older_adults instead of young_adults
CREATE TYPE age_group AS ENUM ('kids', 'teens', 'adults', 'older_adults', 'all_ages');

-- 2. Update the clips table
ALTER TABLE clips ALTER COLUMN target_age_group TYPE age_group;
ALTER TABLE clips ALTER COLUMN target_age_group SET DEFAULT 'all_ages'::age_group;

-- 3. Update any existing records that have 'young_adults' to 'older_adults'
UPDATE clips SET target_age_group = 'older_adults'::age_group WHERE target_age_group = 'young_adults';

-- 4. Update the episodes table if it exists
-- Note: Add this section if your episodes table has target_age_group column
-- ALTER TABLE episodes ALTER COLUMN target_age_group TYPE age_group;
-- UPDATE episodes SET target_age_group = 'older_adults'::age_group WHERE target_age_group = 'young_adults';

-- 5. Update any other tables that might have age_group references
-- Add similar updates for other tables as needed

-- 6. Create an index on target_age_group for better query performance
CREATE INDEX IF NOT EXISTS idx_clips_target_age_group ON clips(target_age_group);

-- 7. Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON TYPE age_group TO postgres, anon, authenticated, service_role;
-- GRANT ALL ON TABLE clips TO postgres, anon, authenticated, service_role;
