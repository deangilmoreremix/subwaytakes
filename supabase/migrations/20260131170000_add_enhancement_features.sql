-- Token System Tables
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

-- Viral Scoring Table
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

-- Reroll Lineage Table
CREATE TABLE IF NOT EXISTS clip_rerolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_clip_id UUID REFERENCES clips(id),
  child_clip_id UUID REFERENCES clips(id),
  intensity TEXT CHECK (intensity IN ('mild', 'medium', 'spicy', 'nuclear')),
  token_cost INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beats for Episodes
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

-- Subscriptions Table
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

-- Add new columns to clips table
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

-- Add index for viral scores
CREATE INDEX IF NOT EXISTS idx_viral_scores_clip_id ON viral_scores(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_rerolls_parent ON clip_rerolls(parent_clip_id);
CREATE INDEX IF NOT EXISTS idx_episode_beats_episode ON episode_beats(episode_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON token_transactions(user_id);

-- RLS Policies
ALTER TABLE token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_rerolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DO $$
BEGIN
  -- Token balances policies
  BEGIN
    CREATE POLICY "Users can view own token balance" ON token_balances FOR SELECT USING (user_id = auth.uid());
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    CREATE POLICY "Users can update own token balance" ON token_balances FOR UPDATE USING (user_id = auth.uid());
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  -- Token transactions policies
  BEGIN
    CREATE POLICY "Users can view own transactions" ON token_transactions FOR SELECT USING (user_id = auth.uid());
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  -- Viral scores policies
  BEGIN
    CREATE POLICY "Users can view viral scores for their clips" ON viral_scores FOR SELECT 
      USING (clip_id IN (SELECT id FROM clips WHERE user_id = auth.uid()));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  -- Clip rerolls policies
  BEGIN
    CREATE POLICY "Users can view rerolls for their clips" ON clip_rerolls FOR SELECT 
      USING (parent_clip_id IN (SELECT id FROM clips WHERE user_id = auth.uid()));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  -- Episode beats policies
  BEGIN
    CREATE POLICY "Users can view beats for their episodes" ON episode_beats FOR SELECT 
      USING (episode_id IN (SELECT id FROM episodes WHERE user_id = auth.uid()));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  -- Subscriptions policies
  BEGIN
    CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (user_id = auth.uid());
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
