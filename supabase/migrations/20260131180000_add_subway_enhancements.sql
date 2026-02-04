-- Migration: Add subway enhancement fields to clips table
-- Created: 2026-01-31

-- Add new columns for subway enhancements
ALTER TABLE clips 
ADD COLUMN IF NOT EXISTS subway_line TEXT,
ADD COLUMN IF NOT EXISTS subway_enhancements JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN clips.subway_line IS 'NYC Subway line (1, 2, 3, 4, 5, 6, 7, A, C, E, B, D, F, M, N, Q, R, W, G, J, Z, L, S, any)';

COMMENT ON COLUMN clips.subway_enhancements IS 'JSON object containing all 10 subway enhancement configurations:
{
  "multiStopJourney": { "enabled": boolean, "stops": [...], "narrativeArc": string },
  "crowdReactions": { "enabled": boolean, "reactions": [...], "density": string, "engagement": string },
  "soundscape": { "enabled": boolean, "layers": [...], "musicMood": string },
  "plotTwist": { "type": string, "timing": number, "impact": string, "description": string },
  "platformPoll": { "enabled": boolean, "question": string, "pollType": string, "responses": [...] },
  "subwayLine": string,
  "trainArrival": { "enabled": boolean, "timing": string, "effect": string, "line": string, "direction": string },
  "seasonalContext": { "enabled": boolean, "season": string, "weather": string, "holiday": string, "cityEvent": string, "decorations": boolean, "crowdAttire": string },
  "transferPoint": { "enabled": boolean, "triggerStation": string, "newLine": string, "pivotType": string, "newQuestion": string, "transitionPhrase": string }
}';

-- Create index for querying by subway line
CREATE INDEX IF NOT EXISTS idx_clips_subway_line ON clips(subway_line) WHERE subway_line IS NOT NULL;

-- Create index for querying clips with enhancements
CREATE INDEX IF NOT EXISTS idx_clips_subway_enhancements ON clips(subway_enhancements) WHERE subway_enhancements IS NOT NULL;
