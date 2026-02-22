/*
  # Add Missing Topic Contexts to System Prompts

  1. Changes
    - Updates studio_interview system prompt metadata with topic_contexts
    - Updates motivational system prompt metadata with topic_contexts
    - Expands street_interview system prompt metadata with additional topic_contexts
    - Expands wisdom_interview system prompt metadata with additional topic_contexts

  2. Important Notes
    - Only updates system-level records (user_id IS NULL)
    - Topic contexts help the AI generate more relevant scripts
    - Topics like retirement, health, legacy, family are now available across all video types
*/

-- Update STUDIO INTERVIEW with topic contexts
UPDATE system_prompts
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{topic_contexts}',
  '{
    "money": "wealth management, financial strategy, investing insights, economic trends",
    "career": "leadership, career growth, professional development, industry expertise",
    "tech": "technology trends, AI, innovation, digital transformation, startup ecosystem",
    "dating": "relationships, modern dating, communication, partnership dynamics",
    "philosophy": "life philosophy, purpose, meaning, ethical questions, deep thinking",
    "personal": "personal growth, self-improvement, habits, productivity",
    "socialmedia": "digital presence, content strategy, social media impact",
    "health": "wellness strategies, mental health, longevity, performance optimization",
    "fitness": "training philosophy, athletic performance, health habits",
    "family": "family dynamics, parenting strategies, relationship management",
    "music": "music industry, creative process, artistic vision",
    "sports": "competitive mindset, team dynamics, sports culture",
    "travel": "global perspectives, cultural experiences, adventure lifestyle",
    "hustle": "entrepreneurship, business building, startup culture, wealth creation",
    "mentalhealth": "mental wellness, therapy culture, burnout, work-life balance",
    "generational": "generational perspectives, cultural shifts, changing values"
  }'::jsonb
),
    updated_at = now()
WHERE video_type = 'studio_interview' AND user_id IS NULL AND is_active = true;

-- Update MOTIVATIONAL with topic contexts
UPDATE system_prompts
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{topic_contexts}',
  '{
    "money": "financial freedom, wealth mindset, hustle culture, building empire",
    "career": "career domination, leadership, professional excellence, grinding",
    "fitness": "physical transformation, discipline, training mentality, never quit",
    "mentalhealth": "mental toughness, resilience, overcoming darkness, inner strength",
    "personal": "self-improvement, identity, becoming the best version, daily habits",
    "hustle": "entrepreneurship, grinding, building from nothing, relentless pursuit",
    "philosophy": "purpose, legacy, meaning of life, finding your path",
    "relationships": "meaningful connections, boundaries, self-worth, love and respect",
    "health": "wellness transformation, mind-body connection, longevity, vitality",
    "family": "family sacrifice, providing, protecting what matters, generational impact",
    "sports": "athletic greatness, competition, champion mindset, never backing down",
    "generational": "breaking cycles, building legacy, generational wealth, changing the narrative"
  }'::jsonb
),
    updated_at = now()
WHERE video_type = 'motivational' AND user_id IS NULL AND is_active = true;

-- Expand STREET INTERVIEW topic contexts
UPDATE system_prompts
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{topic_contexts}',
  '{
    "money": "finances, wealth, spending habits, financial decisions",
    "dating": "relationships, dating apps, love life, romantic experiences",
    "hottakes": "controversial opinions, unpopular beliefs, spicy takes",
    "personal": "personal life, habits, secrets, guilty pleasures",
    "career": "work life, jobs, professional experiences, workplace culture",
    "philosophy": "life meaning, deep thoughts, existential questions",
    "fitness": "gym culture, workouts, health habits",
    "tech": "technology, social media, AI, gadgets",
    "socialmedia": "online presence, influencers, screen time",
    "family": "parents, siblings, family dynamics, raising kids",
    "friendship": "friends, social circles, relationships, loyalty",
    "hustle": "side hustles, entrepreneurship, making money",
    "mentalhealth": "mental wellness, therapy, self-care, burnout",
    "generational": "gen z, millennials, boomers, generational differences",
    "food": "eating habits, favorite foods, cooking, restaurants",
    "music": "music taste, concerts, favorite artists, playlists",
    "sports": "athletics, teams, sports culture, rivalries",
    "travel": "traveling, destinations, adventures, bucket list",
    "nyc": "New York City life, subway stories, city experiences",
    "health": "wellness, aging, mobility, longevity",
    "retirement": "life after work, pensions, purpose in retirement",
    "relationships": "marriage, family bonds, community connections"
  }'::jsonb
),
    updated_at = now()
WHERE video_type = 'street_interview' AND user_id IS NULL AND is_active = true;

-- Expand WISDOM INTERVIEW topic contexts
UPDATE system_prompts
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{topic_contexts}',
  '{
    "retirement": "life after work, pensions, purpose in retirement, active aging",
    "health": "wellness, aging gracefully, mobility, longevity, staying sharp",
    "legacy": "what you leave behind, life lessons, impact on others, generational wisdom",
    "relationships": "marriage, family bonds, community connections, lasting friendships",
    "wisdom": "hard-earned life lessons, advice for younger generations",
    "money": "financial wisdom, retirement savings, avoiding scams, healthcare costs",
    "family": "grandchildren, family dynamics, empty nest, generational connections",
    "career": "late-career reinvention, mentoring, consulting, professional legacy",
    "personal": "regrets, freedom, what matters most, self-discovery",
    "mentalhealth": "purpose, loneliness, staying engaged, mental sharpness",
    "friendship": "maintaining friendships, making new connections, community",
    "philosophy": "meaning of life, what truly matters, lessons from experience"
  }'::jsonb
),
    updated_at = now()
WHERE video_type = 'wisdom_interview' AND user_id IS NULL AND is_active = true;
