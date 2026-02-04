# SubwayTakes Architectural Enhancement Plan

## Overview
This document outlines the architectural enhancements to transform SubwayTakes into a viral interview platform with Studio Interview support, conversation beats, viral scoring, and a modern dashboard.

## Phase 1: Type System & Schema Updates

### 1.1 Extended Clip Types
Add `studio_interview` as the 3rd interview type alongside existing types:

```typescript
export type ClipType = 'motivational' | 'street_interview' | 'subway_interview' | 'studio_interview';
```

### 1.2 Interview Modes (10 Viral Modes)
New type for viral interview content modes:

```typescript
export type InterviewMode = 
  | 'hot_take_challenge'      // Controversial opinions, debate format
  | 'rapid_fire_round'        // Quick succession questions
  | 'deep_dive_interview'     // Long-form philosophical
  | 'myth_busters'            // Debunking common beliefs
  | 'would_you_rather'        // Choice-based scenarios
  | 'story_time'              // Narrative personal stories
  | 'unpopular_opinion'       // Defending controversial stances
  | 'roast_me'                // Self-deprecating humor
  | 'truth_or_dare_style'     // Risk/reveal format
  | 'expert_take'             // Authority perspective on trending topics
  | 'none';                   // Default, no specific mode
```

### 1.3 Beats Schema (Conversation Flow)
New types for structured conversation beats:

```typescript
export type BeatType = 'take' | 'reaction' | 'discussion';

export interface Beat {
  id: string;
  type: BeatType;
  speaker: 'host' | 'guest';
  content: string;           // The actual line/script
  duration: number;          // Estimated seconds
  emotionalTone: EmotionalTone;
  cameraDirection: CameraDirection;
}

export type EmotionalTone =
  | 'neutral'
  | 'excited'
  | 'shocked'
  | 'thoughtful'
  | 'defensive'
  | 'aggressive'
  | 'playful'
  | 'sincere'
  | 'sarcastic'
  | 'passionate';

export interface ConversationBeats {
  beats: Beat[];
  totalDuration: number;
  viralHooks: string[];      // Identified viral moments
}
```

### 1.4 Viral Scoring System

```typescript
export interface ViralScore {
  overall: number;           // 0-100
  components: {
    hookStrength: number;    // First 3 seconds grab
    emotionalArc: number;    // Journey from start to end
    shareability: number;    // Would viewers share this?
    replayValue: number;     // Worth watching again
    commentBait: number;     // Sparks discussion
  };
  suggestions: string[];     // AI suggestions to improve
}

export interface ClipWithViral extends Clip {
  viral_score: ViralScore | null;
  reroll_count: number;
  parent_clip_id: string | null;  // For tracking reroll lineage
}
```

### 1.5 Token-Based Subscription System

```typescript
export type SubscriptionTier = 'free' | 'creator' | 'pro' | 'studio';

export interface TokenBalance {
  userId: string;
  monthlyTokens: number;     // Resets monthly
  purchasedTokens: number;   // Never expires
  usedThisMonth: number;
  lastResetDate: string;
}

export interface TokenTransaction {
  id: string;
  userId: string;
  type: 'monthly_allocation' | 'purchase' | 'usage' | 'refund';
  amount: number;
  description: string;
  clipId?: string;
  createdAt: string;
}

// Token costs per operation
export const TOKEN_COSTS = {
  generate_clip_standard: 10,
  generate_clip_premium: 25,
  generate_clip_studio: 40,
  reroll_clip: 15,
  spicier_reroll: 25,
  viral_analysis: 5,
  batch_series_3: 25,
  batch_series_5: 40,
  batch_series_10: 75,
} as const;

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  monthlyTokens: number;
  monthlyPrice: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    tier: 'free',
    monthlyTokens: 50,
    monthlyPrice: 0,
    features: ['Standard models', 'Basic interview modes', '5 clips/month'],
  },
  {
    tier: 'creator',
    monthlyTokens: 200,
    monthlyPrice: 19,
    features: ['Premium models', 'All interview modes', 'Viral scoring', 'Rerolls'],
  },
  {
    tier: 'pro',
    monthlyTokens: 500,
    monthlyPrice: 49,
    features: ['Studio interviews', 'Batch generation', 'Priority processing', 'API access'],
  },
  {
    tier: 'studio',
    monthlyTokens: 2000,
    monthlyPrice: 149,
    features: ['Unlimited team seats', 'Custom branding', 'Dedicated support', 'White-label options'],
  },
];
```

### 1.6 Spicier Reroll System

```typescript
export type RerollIntensity = 'mild' | 'medium' | 'spicy' | 'nuclear';

export interface RerollOptions {
  intensity: RerollIntensity;
  preserveElements: {
    topic: boolean;
    setting: boolean;
    characters: boolean;
    duration: boolean;
  };
  enhanceElements: {
    energy: boolean;
    controversy: boolean;
    humor: boolean;
    emotion: boolean;
  };
}

export const REROLL_INTENSITY_CONFIG: Record<RerollIntensity, {
  description: string;
  tokenCost: number;
  promptModifiers: string[];
}> = {
  mild: {
    description: 'Slight variation, same vibe',
    tokenCost: 15,
    promptModifiers: ['subtle variation', 'fresh take on same concept'],
  },
  medium: {
    description: 'Noticeably different approach',
    tokenCost: 25,
    promptModifiers: ['bold reinterpretation', 'unexpected angle'],
  },
  spicy: {
    description: 'High energy, controversial',
    tokenCost: 40,
    promptModifiers: ['provocative stance', 'polarizing opinion', 'viral-worthy reaction'],
  },
  nuclear: {
    description: 'Maximum chaos, unforgettable',
    tokenCost: 60,
    promptModifiers: ['extreme controversy', 'shocking revelation', 'meme-worthy moment', 'breaks the internet potential'],
  },
};
```

### 1.7 Studio Interview Specific Types

```typescript
export type StudioSetup = 
  | 'podcast_desk'           // Classic podcast table setup
  | 'living_room'            // Comfortable couch/chairs
  | 'minimalist_stage'       // Clean backdrop, professional
  | 'late_night'             // Desk with city backdrop
  | 'roundtable'             // Multiple guests
  | 'fireside'               // Intimate, warm setting
  | 'news_desk'              // Broadcast journalism style
  | 'creative_loft';         // Artistic, industrial vibe

export type StudioLighting =
  | 'three_point'            // Classic professional
  | 'dramatic_key'           // High contrast
  | 'soft_diffused'          // Flattering, even
  | 'colored_accent'         // RGB accent lights
  | 'natural_window'         // Window light simulation
  | 'cinematic';             // Movie-quality lighting

export interface StudioOptions {
  setup: StudioSetup;
  lighting: StudioLighting;
  background: string;        // Description or preset
  guestCount: number;        // 1-4 guests
  branded: boolean;          // Show logo/watermark
}
```

## Phase 2: Component Architecture

### 2.1 New Components to Create

#### Studio Interview Components
- `StudioSetupSelector` - Choose studio configuration
- `StudioLightingSelector` - Lighting mood selection
- `InterviewModeSelector` - 10 viral mode selection
- `BeatBuilder` - Visual beat timeline editor
- `BeatCard` - Individual beat display/editor
- `ViralScoreCard` - Display viral scoring results
- `RerollPanel` - Reroll options and intensity selector
- `TokenDisplay` - Show current token balance
- `TokenHistory` - Transaction history table
- `SubscriptionCard` - Plan selection and management

#### Dashboard Components
- `DashboardLayout` - Modern dashboard shell
- `StatsGrid` - Key metrics display
- `RecentActivity` - Latest clips and actions
- `QuickActions` - One-click common tasks
- `ViralPotentialFeed` - Clips with high viral scores
- `TokenBalanceWidget` - Compact balance display

### 2.2 Enhanced Existing Components

#### EpisodeBuilderPage
- Add beat timeline visualization
- Integrate viral scoring preview
- Add interview mode selection
- Support studio interview type

#### CreatePage
- Add studio interview option to ClipTypeSelector
- Add interview mode selector
- Show token cost before generation
- Add "Make it Spicier" reroll button

#### ClipPage
- Display viral score if available
- Show reroll history/lineage
- Add reroll action buttons
- Show token cost for actions

## Phase 3: Page Structure

### 3.1 New Pages

#### Modern Dashboard (`/dashboard`)
```
DashboardLayout
├── Header with TokenBalanceWidget
├── StatsGrid (clips created, viral score avg, tokens used)
├── QuickActions (Create Clip, Batch Generate, Browse Library)
├── RecentActivity (last 5 clips with status)
└── ViralPotentialFeed (top 5 viral clips)
```

#### Subscription Management (`/billing`)
```
SubscriptionPage
├── CurrentPlanCard
├── PlanComparisonTable
├── TokenPurchaseModal
└── BillingHistory
```

### 3.2 Enhanced Pages

#### CreatePage - Studio Interview Tab
New tab for studio interview with:
- Studio setup selector
- Guest count selector
- Lighting mood selector
- Interview mode selector
- Beat preview (auto-generated)

#### EpisodeBuilderPage - Beats Integration
- Beat timeline visualization
- Drag-and-drop beat reordering
- Beat type indicators (Take/Reaction/Discussion)
- Auto-generate beats from topic

## Phase 4: Database Schema Updates

### 4.1 New Tables

```sql
-- Token system
CREATE TABLE token_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  monthly_tokens INTEGER DEFAULT 0,
  purchased_tokens INTEGER DEFAULT 0,
  used_this_month INTEGER DEFAULT 0,
  last_reset_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT CHECK (type IN ('monthly_allocation', 'purchase', 'usage', 'refund')),
  amount INTEGER NOT NULL,
  description TEXT,
  clip_id UUID REFERENCES clips(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Viral scoring
CREATE TABLE viral_scores (
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

-- Reroll lineage
CREATE TABLE clip_rerolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_clip_id UUID REFERENCES clips(id),
  child_clip_id UUID REFERENCES clips(id),
  intensity TEXT CHECK (intensity IN ('mild', 'medium', 'spicy', 'nuclear')),
  token_cost INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beats for episodes
CREATE TABLE episode_beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES episodes(id),
  sequence INTEGER NOT NULL,
  type TEXT CHECK (type IN ('take', 'reaction', 'discussion')),
  speaker TEXT CHECK (speaker IN ('host', 'guest')),
  content TEXT NOT NULL,
  duration INTEGER,
  emotional_tone TEXT,
  camera_direction TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tier TEXT CHECK (tier IN ('free', 'creator', 'pro', 'studio')),
  status TEXT CHECK (status IN ('active', 'cancelled', 'past_due')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Enhanced Clips Table

```sql
-- Add columns to existing clips table
ALTER TABLE clips ADD COLUMN IF NOT EXISTS interview_mode TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS studio_setup TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS studio_lighting TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 1;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS reroll_count INTEGER DEFAULT 0;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS parent_clip_id UUID REFERENCES clips(id);
ALTER TABLE clips ADD COLUMN IF NOT EXISTS token_cost INTEGER;
```

## Phase 5: Implementation Order

### Phase 5.1: Foundation (Week 1)
1. Update types in `src/lib/types.ts`
2. Add constants in `src/lib/constants.ts`
3. Create database migrations
4. Update existing components to handle new types

### Phase 5.2: Studio Interview (Week 1-2)
1. Create StudioSetupSelector component
2. Create StudioLightingSelector component
3. Add studio interview tab to CreatePage
4. Update prompt engine for studio prompts

### Phase 5.3: Interview Modes (Week 2)
1. Create InterviewModeSelector component
2. Add mode selection to all interview types
3. Update prompt engine with mode modifiers
4. Create mode-specific prompt templates

### Phase 5.4: Beats System (Week 2-3)
1. Create BeatBuilder component
2. Create BeatCard component
3. Integrate beats into EpisodeBuilderPage
4. Update episode generation with beats support

### Phase 5.5: Token System (Week 3)
1. Create token balance display components
2. Create TokenHistory component
3. Add token costs to generation flows
4. Create billing page

### Phase 5.6: Reroll System (Week 3-4)
1. Create RerollPanel component
2. Implement reroll logic
3. Add spicier reroll options
4. Track reroll lineage

### Phase 5.7: Viral Scoring (Week 4)
1. Create ViralScoreCard component
2. Implement scoring algorithm
3. Add viral analysis to clips
4. Create viral potential feed

### Phase 5.8: Modern Dashboard (Week 4)
1. Create DashboardLayout
2. Create StatsGrid component
3. Create RecentActivity component
4. Create QuickActions component
5. Build main dashboard page

## Phase 6: API & Edge Functions

### 6.1 New Edge Functions
- `calculate-viral-score` - Analyze clip for viral potential
- `generate-beats` - Auto-generate conversation beats
- `process-reroll` - Handle clip reroll with intensity
- `check-token-balance` - Verify and deduct tokens

### 6.2 Enhanced Edge Functions
- `generate-script` - Add beats generation, mode support
- `generate-video` - Add studio setup support
- `stitch-episode` - Handle beats-based stitching

## Phase 7: Integration Points

### 7.1 Existing Features to Preserve
- All clip types: motivational, street_interview, subway_interview
- All speaker styles, camera styles, lighting moods
- Episode builder functionality
- Question bank system
- Batch series generation
- Character presets
- All existing UI components

### 7.2 Backward Compatibility
- All new fields are optional/nullable
- Existing clips work without modification
- Default values for all new enums
- Graceful degradation for unsupported features

## Success Metrics

- All 10 interview modes functional
- Studio interview generates distinct visual style
- Beats system creates coherent conversation flow
- Token system accurately tracks and deducts
- Reroll system produces varied outputs
- Viral scoring provides actionable insights
- Dashboard improves user workflow efficiency
- Zero regression in existing features
