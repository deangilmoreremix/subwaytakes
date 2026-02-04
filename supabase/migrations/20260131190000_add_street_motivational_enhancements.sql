-- Migration: Add Street Interview and Motivational Enhancement Support
-- This migration adds columns to support the 20 new enhancement features

-- Add Street Interview enhancement columns
ALTER TABLE clips ADD COLUMN street_enhancements JSONB;
ALTER TABLE clips ADD COLUMN neighborhood TEXT;

-- Add Motivational enhancement columns  
ALTER TABLE clips ADD COLUMN motivational_enhancements JSONB;
ALTER TABLE clips ADD COLUMN speaker_archetype TEXT;

-- Add indexes for querying by enhancement types
CREATE INDEX idx_clips_street_enhancements ON clips USING GIN (street_enhancements);
CREATE INDEX idx_clips_motivational_enhancements ON clips USING GIN (motivational_enhancements);
CREATE INDEX idx_clips_neighborhood ON clips (neighborhood);
CREATE INDEX idx_clips_speaker_archetype ON clips (speaker_archetype);

-- Add comment explaining the enhancement structure
COMMENT ON COLUMN clips.street_enhancements IS 'JSON configuration for street interview enhancements including multi-location journey, crowd dynamics, urban soundscape, plot twists, polls, dramatic moments, seasonal context, and cross-street pivots';

COMMENT ON COLUMN clips.motivational_enhancements IS 'JSON configuration for motivational clip enhancements including transformation arcs, audience energy, soundscape, breakthrough moments, event energy arcs, live challenges, speaker archetypes, pauses, achievement context, and CTA pivots';

COMMENT ON COLUMN clips.neighborhood IS 'NYC neighborhood for street interviews (soho, harlem, williamsburg, fidi, times_square, chelsea, east_village)';

COMMENT ON COLUMN clips.speaker_archetype IS 'Speaker style archetype for motivational clips (drill_sergeant, tony_robbins, brene_brown, gary_vee, oprah, eric_thomas, simon_sinek)';
