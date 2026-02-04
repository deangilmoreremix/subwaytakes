# StreetSpeak AI - Comprehensive Feature Specification

## Executive Summary
This document outlines the complete feature set for StreetSpeak AI, a platform for generating viral street interview videos with professional production values.

**Excluded Features:**
- Consistent Characters system (not requested)

---

## Feature 1: Self-Cloning System

### Overview
Upload one photo to create a realistic AI version of yourself with your style and mannerisms, enabling personal branding without being on camera.

### Implementation Requirements

#### Upload Flow
```typescript
interface CloneRequest {
  userId: string;
  sourcePhotos: string[]; // URLs to uploaded photos
  styleNotes: string; // Text description of mannerisms
  voiceSample?: string; // Optional voice sample URL
  consentDeclaration: boolean;
  targetUse: 'personal' | 'commercial' | 'educational';
}

interface CloneResult {
  cloneId: string;
  status: 'processing' | 'ready' | 'failed';
  previewUrl?: string;
  confidenceScore: number;
  estimatedReadyTime?: Date;
}
```

#### Processing Pipeline
1. **Photo Analysis**
   - Face detection and alignment
   - Feature extraction (eyes, mouth, pose)
   - Lighting and quality assessment
   - Multiple angle detection

2. **Style Learning**
   - Clothing style extraction
   - Pose preferences
   - Mannerism mapping from user notes
   - Voice style analysis (if provided)

3. **Model Generation**
   - Create character profile from analysis
   - Generate style-consistent variations
   - Quality validation
   - User approval step

#### UI Components
1. **Clone Wizard**
   - Photo upload zone (drag & drop)
   - Photo quality preview
   - Style description input
   - Voice sample upload (optional)
   - Preview and approval step

2. **Clone Manager**
   - View all clones
   - Regenerate from new photos
   - Clone performance analytics
   - Delete/manage clones

#### Database Schema
```sql
-- Self clones table
CREATE TABLE self_clones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  source_photos TEXT[] NOT NULL,
  style_notes TEXT,
  voice_sample_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'processing',
  model_url VARCHAR(500),
  confidence_score DECIMAL(3,2),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Feature 2: Keyword-to-Viral Interview Generator

### Overview
Enter a single keyword and generate full street-style interviews automatically, without scripts or prompts.

### Implementation Requirements

#### Keyword Analysis Engine
```typescript
interface KeywordAnalysis {
  keyword: string;
  category: 'money' | 'fitness' | 'relationships' | 'business' | 'lifestyle' | 'tech' | 'other';
  subtopics: string[];
  controversyLevel: number; // 0-1
  trendingScore: number; // 0-1
  audienceDemographics: DemographicInfo;
  potentialAngles: string[];
}

interface DemographicInfo {
  ageRange: string;
  interests: string[];
  platformPreference: string[];
  contentStyle: string;
}
```

#### Auto-Interview Generation
```typescript
interface AutoInterviewConfig {
  keyword: string;
  topicDepth: 'surface' | 'moderate' | 'deep';
  tone: 'casual' | 'professional' | 'controversial' | 'humorous';
  length: 'short' | 'medium' | 'long';
  intervieweePersona: PersonaConfig;
  questionStyle: 'rapid_fire' | 'thoughtful' | 'debate' | 'story';
}

interface GeneratedInterview {
  id: string;
  keyword: string;
  topic: string;
  questions: InterviewQuestion[];
  suggestedAnswers: string[];
  estimatedDuration: number;
  viralScore: number;
  talkingPoints: string[];
}
```

#### Generation Pipeline
1. **Keyword Processing**
   - NLP analysis of keyword
   - Related topic extraction
   - Trend data lookup
   - Audience matching

2. **Content Planning**
   - Generate interview outline
   - Create question sequence
   - Map to viral style templates
   - Calculate engagement potential

3. **Script Generation**
   - Natural question generation
   - Contextually appropriate answers
   - Emotion trigger placement
   - CTA integration

#### UI Components
1. **Keyword Input Interface**
   - Single input field with smart suggestions
   - Auto-complete dropdown
   - Trending keywords display
   - Category icons

2. **Generation Preview**
   - Question list preview
   - Estimated engagement metrics
   - Duration estimate
   - Edit/regenerate options

#### Prompt Integration
```typescript
const KEYWORD_GENERATION_PROMPT = `
Generate a viral street interview based on keyword: "{keyword}"

CONTEXT:
- Category: {category}
- Target audience: {audience}
- Tone: {tone}
- Length: {length}

Generate 5-10 natural questions that would spark engagement, debate, or shares.
Include follow-up angles and potential emotional triggers.

OUTPUT FORMAT:
[
  { "question": "...", "followUp": "...", "emotion": "..." }
]
`;
```

---

## Feature 3: Interview Format Selection

### Overview
Choose how the interview appears - solo, face-to-face, reporter style, or full-body street shots.

### Format Options

| Format | Description | Use Case |
|--------|-------------|----------|
| `solo` | Single subject, medium shot | Quick tips, hot takes |
| `face_to_face` | Interviewer + subject, two-shot | Debates, deep dives |
| `reporter_style` | Reporter with mic, handheld | News, investigations |
| `full_body` | Subject full frame, street setting | Lifestyle, fashion |
| `pov_interviewer` | First-person interviewer POV | Immersive content |
| `group` | Multiple people, round-robin | Panel discussions |

### Implementation

#### Format Configuration
```typescript
type InterviewFormat = 'solo' | 'face_to_face' | 'reporter_style' | 'full_body' | 'pov_interviewer' | 'group';

interface FormatConfig {
  format: InterviewFormat;
  cameraAngle: CameraAngle;
  shotType: ShotType;
  framing: Framing;
  movement: CameraMovement;
}

interface CameraAngle {
  primary: 'eye_level' | 'low' | 'high' | 'drone';
  secondary?: string;
}

interface ShotType {
  wide: string;
  medium: string;
  closeup: string;
}

interface Framing {
  subject: FramingConfig;
  interviewer?: FramingConfig;
}

interface FramingConfig {
  position: 'left' | 'center' | 'right' | 'split';
  distance: 'full' | 'three_quarters' | 'medium' | 'close';
}

interface CameraMovement {
  style: 'static' | 'slow_pan' | 'push_in' | 'orbit' | 'handheld';
  intensity: 'subtle' | 'moderate' | 'dynamic';
}
```

#### Visual Style Mapping
```typescript
const FORMAT_VISUAL_STYLES: Record<InterviewFormat, VisualStyle> = {
  solo: {
    shot: 'medium_closeup',
    background: 'street_blur',
    lighting: 'natural',
    energy: 'calm',
  },
  face_to_face: {
    shot: 'two_shot',
    background: 'street_context',
    lighting: 'rim_light',
    energy: 'engaged',
  },
  reporter_style: {
    shot: 'over_shoulder',
    background: 'location',
    lighting: 'documentary',
    energy: 'urgent',
  },
  full_body: {
    shot: 'wide_to_medium',
    background: 'environment',
    lighting: 'cinematic',
    energy: 'confident',
  },
  pov_interviewer: {
    shot: 'first_person',
    background: 'street_motion',
    lighting: 'ambient',
    energy: 'curious',
  },
  group: {
    shot: 'wide_group',
    background: 'street_context',
    lighting: 'even',
    energy: 'dynamic',
  },
};
```

---

## Feature 4: Video Length Control

### Overview
Create videos from 8 to 160 seconds. Short clips for hooks, longer clips for trust building.

### Implementation

#### Duration Configuration
```typescript
interface DurationConfig {
  targetSeconds: number; // 8-160
  minSeconds: number;
  maxSeconds: number;
  clipStrategy: 'auto' | 'short_first' | 'long_build' | 'balanced';
  pacingStyle: 'fast' | 'normal' | 'slow';
}

const DURATION_PRESETS = [
  { label: 'Hook (8-15s)', min: 8, max: 15, strategy: 'short_first' },
  { label: 'Quick (15-30s)', min: 15, max: 30, strategy: 'balanced' },
  { label: 'Standard (30-60s)', min: 30, max: 60, strategy: 'balanced' },
  { label: 'Deep (60-90s)', min: 60, max: 90, strategy: 'long_build' },
  { label: 'Long Form (90-160s)', min: 90, max: 160, strategy: 'long_build' },
] as const;
```

#### Adaptive Content Generation
```typescript
interface ContentAdapter {
  adjustContentLength(content: ScriptContent, targetDuration: number): ScriptContent;
  calculateOptimalPacing(content: ScriptContent): PacingPlan;
  identifyKeyMoments(content: ScriptContent): Highlight[];
}

interface PacingPlan {
  introDuration: number;
  questionDensity: number; // questions per minute
  answerLength: 'brief' | 'moderate' | 'detailed';
  pacingVariation: number; // variance in timing
}

interface Highlight {
  position: number; // percentage through video
  type: 'hook' | 'twist' | 'cta' | 'insight';
  importance: number;
}
```

---

## Feature 5: Product Placement System

### Overview
Optionally blend product or service mentions naturally into conversations.

### Implementation

#### Product Configuration
```typescript
interface ProductPlacementConfig {
  enabled: boolean;
  productName: string;
  productDescription: string;
  callToAction: string;
  placementStyle: 'subtle' | 'moderate' | 'prominent';
  integrationType: 'end_card' | 'natural_mention' | 'demonstration';
  offerCode?: string;
  affiliateLink?: string;
}

interface PlacementScript {
  mentionPoints: MentionPoint[];
  suggestedScript: string;
  visualCues: VisualCue[];
}

interface MentionPoint {
  timestamp: number;
  type: 'text' | 'visual' | 'both';
  script: string;
  emphasis: 'low' | 'medium' | 'high';
}

interface VisualCue {
  timestamp: number;
  description: string;
  duration: number;
}
```

#### Script Integration
```typescript
const PRODUCT_PLACEMENT_PROMPT = `
NATURAL PRODUCT INTEGRATION:
Product: {product_name}
Description: {product_description}
Placement Style: {placement_style}

Generate a natural conversation segment that organically incorporates the product.
The mention should feel like a genuine opinion or recommendation, not a sales pitch.

GUIDELINES:
- Never sound scripted or rehearsed
- Connect product to topic naturally
- Include social proof if available
- End with subtle call to action

Generate {mention_count} mention points throughout the conversation.
`;
```

---

## Feature 6: Multi-Language Support

### Overview
Create street interview videos in 12+ languages with native speakers.

### Implementation

#### Language Configuration
```typescript
type SupportedLanguage = 
  | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt'
  | 'zh' | 'ja' | 'ko' | 'hi' | 'ar' | 'ru';

interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  voiceId: string;
  accent: string;
  supportedDialects: string[];
}

const LANGUAGE_OPTIONS: LanguageConfig[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', voiceId: 'en_us', accent: 'American', supportedDialects: ['American', 'British', 'Australian'] },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', voiceId: 'es_es', accent: 'Castilian', supportedDialects: ['Castilian', 'Mexican', 'Colombian', 'Argentine'] },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', voiceId: 'fr_fr', accent: 'Parisian', supportedDialects: ['Parisian', 'Quebecois', 'Swiss'] },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', voiceId: 'de_de', accent: 'Standard', supportedDialects: ['Standard', 'Bavarian', 'Swiss'] },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', voiceId: 'it_it', accent: 'Standard', supportedDialects: ['Tuscan', 'Roman', 'Milanese'] },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', voiceId: 'pt_br', accent: 'Brazilian', supportedDialects: ['Brazilian', 'European'] },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', voiceId: 'zh_cn', accent: 'Mandarin', supportedDialects: ['Simplified', 'Traditional', 'Cantonese'] },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', voiceId: 'ja_jp', accent: 'Standard', supportedDialects: ['Tokyo', 'Osaka'] },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', voiceId: 'ko_kr', accent: 'Standard', supportedDialects: ['Seoul', 'Busan'] },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', voiceId: 'hi_in', accent: 'Standard', supportedDialects: ['Hindi', 'Urdu'] },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', voiceId: 'ar_sa', accent: 'Standard', supportedDialects: ['Modern Standard', 'Egyptian', 'Gulf'] },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', voiceId: 'ru_ru', accent: 'Standard', supportedDialects: ['Moscow', 'St. Petersburg'] },
];
```

#### Translation Pipeline
```typescript
interface TranslationRequest {
  sourceScript: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  dialect?: string;
  preserveStyle: boolean;
  culturalAdaptation: boolean;
}

interface TranslationResult {
  translatedScript: string;
  targetLanguage: SupportedLanguage;
  dialectUsed: string;
  culturalNotes: string[];
  voiceId: string;
  estimatedDuration: number;
}
```

---

## Feature 7: Auto-Captions System

### Overview
Generate high-impact captions with viral styles, customizable fonts, colors, and effects.

### Implementation

#### Caption Style Configuration
```typescript
interface CaptionStyleConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  textShadow: TextShadow;
  textOutline: TextOutline;
  position: 'bottom' | 'center' | 'top';
  animation: CaptionAnimation;
  highlightWords: HighlightWord[];
}

interface TextShadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

interface TextOutline {
  enabled: boolean;
  color: string;
  width: number;
}

interface CaptionAnimation {
  style: 'static' | 'pop' | 'slide' | 'typewriter' | 'karaoke';
  duration: number;
  easing: string;
}

interface HighlightWord {
  word: string;
  color: string;
  animation: 'bold' | 'color' | 'underline' | 'scale';
}
```

#### Viral Caption Presets
```typescript
const CAPTION_PRESETS = {
  standard: {
    fontFamily: 'Inter',
    fontSize: 24,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.6,
    animation: 'static',
  },
  tiktok: {
    fontFamily: 'Montserrat',
    fontSize: 28,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.7,
    animation: 'pop',
    highlightWords: [{ word: '🔥', color: '#FFD700', animation: 'scale' }],
  },
  youtube: {
    fontFamily: 'Roboto',
    fontSize: 26,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.5,
    animation: 'slide',
  },
  attention_grabber: {
    fontFamily: 'Inter',
    fontSize: 32,
    textColor: '#FFD700',
    backgroundColor: '#000000',
    backgroundOpacity: 0.8,
    textOutline: { enabled: true, color: '#000000', width: 3 },
    animation: 'pop',
    highlightWords: [{ word: 'WAIT', color: '#FF4444', animation: 'scale' }],
  },
  minimalist: {
    fontFamily: 'Inter',
    fontSize: 22,
    textColor: '#FFFFFF',
    backgroundColor: null,
    textShadow: { enabled: true, color: '#000000', blur: 4, offsetX: 0, offsetY: 0 },
    animation: 'typewriter',
  },
} as const;
```

#### Word-Level Sync
```typescript
interface CaptionSync {
  words: CaptionWord[];
  timing: WordTiming[];
}

interface CaptionWord {
  text: string;
  startTime: number;
  endTime: number;
  emphasis: 'none' | 'low' | 'medium' | 'high';
}

interface WordTiming {
  wordIndex: number;
  timestamp: number;
  duration: number;
}
```

---

## Feature 8: Library & Stitching System

### Overview
Save, pick, and combine interviews into longer videos.

### Implementation

#### Library Organization
```typescript
interface LibraryConfig {
  folders: Folder[];
  tags: Tag[];
  smartCollections: SmartCollection[];
}

interface Folder {
  id: string;
  name: string;
  parentId?: string;
  clipIds: string[];
  coverImage?: string;
  createdAt: Date;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  clipIds: string[];
}

interface SmartCollection {
  id: string;
  name: string;
  rules: CollectionRule[];
}

interface CollectionRule {
  field: 'created_at' | 'duration' | 'viral_score' | 'topic' | 'format';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | number;
}
```

#### Video Stitching
```typescript
interface StitchingProject {
  id: string;
  name: string;
  clips: StitchClip[];
  transitions: Transition[];
  introClipId?: string;
  outroClipId?: string;
  totalDuration: number;
  status: 'draft' | 'rendering' | 'ready';
}

interface StitchClip {
  clipId: string;
  startTime: number;
  endTime: number;
  volume: number;
  position: number;
}

interface Transition {
  type: 'fade' | 'dissolve' | 'wipe' | 'blur' | 'none';
  duration: number;
  fromClipId: string;
  toClipId: string;
}

interface StitchingResult {
  projectId: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  estimatedViralScore: number;
}
```

#### UI Components
1. **Library Grid View**
   - Clip thumbnails with hover previews
   - Multi-select for stitching
   - Drag-to-folder organization
   - Quick filter by tags

2. **Stitching Timeline**
   - Drag-and-drop clip ordering
   - Transition configuration
   - Preview with playback
   - Duration calculator

3. **Smart Collections**
   - Auto-generated collections
   - Custom filter rules
   - Collection performance metrics

---

## Feature 9: Platform Export

### Overview
Export videos in optimal formats for TikTok, Instagram, YouTube, Facebook.

### Implementation

#### Platform Specifications
```typescript
interface PlatformSpec {
  name: string;
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5' | '9:16';
  resolution: { width: number; height: number };
  maxDuration: number;
  recommendedDuration: { min: number; max: number };
  codec: string;
  bitrate: number;
  audioChannels: number;
  fileFormats: string[];
  optimizeFor: 'feed' | 'story' | 'reel' | 'shorts' | 'post';
}

const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  tiktok: {
    name: 'TikTok',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    maxDuration: 180,
    recommendedDuration: { min: 15, max: 60 },
    codec: 'h264',
    bitrate: 8000000,
    audioChannels: 2,
    fileFormats: ['mp4', 'mov'],
    optimizeFor: 'reels',
  },
  instagram_reel: {
    name: 'Instagram Reels',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    maxDuration: 90,
    recommendedDuration: { min: 15, max: 30 },
    codec: 'h264',
    bitrate: 8000000,
    audioChannels: 2,
    fileFormats: ['mp4'],
    optimizeFor: 'reels',
  },
  youtube_shorts: {
    name: 'YouTube Shorts',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    maxDuration: 60,
    recommendedDuration: { min: 15, max: 60 },
    codec: 'h264',
    bitrate: 8000000,
    audioChannels: 2,
    fileFormats: ['mp4', 'mov'],
    optimizeFor: 'shorts',
  },
  instagram_post: {
    name: 'Instagram Post',
    aspectRatio: '4:5',
    resolution: { width: 1080, height: 1350 },
    maxDuration: null,
    recommendedDuration: { min: 10, max: 30 },
    codec: 'h264',
    bitrate: 6000000,
    audioChannels: 2,
    fileFormats: ['mp4'],
    optimizeFor: 'feed',
  },
  facebook: {
    name: 'Facebook',
    aspectRatio: '16:9',
    resolution: { width: 1920, height: 1080 },
    maxDuration: 240,
    recommendedDuration: { min: 30, max: 120 },
    codec: 'h264',
    bitrate: 10000000,
    audioChannels: 2,
    fileFormats: ['mp4'],
    optimizeFor: 'feed',
  },
  youtube: {
    name: 'YouTube',
    aspectRatio: '16:9',
    resolution: { width: 1920, height: 1080 },
    maxDuration: 43200,
    recommendedDuration: { min: 60, max: 600 },
    codec: 'h264',
    bitrate: 12000000,
    audioChannels: 2,
    fileFormats: ['mp4'],
    optimizeFor: 'feed',
  },
};
```

#### Export Workflow
```typescript
interface ExportRequest {
  clipIds: string[];
  platform: keyof typeof PLATFORM_SPECS;
  format: string;
  quality: 'draft' | 'standard' | 'high' | '4k';
  includeCaptions: boolean;
  captionStyleId?: string;
  customSettings?: Partial<PlatformSpec>;
}

interface ExportResult {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}
```

---

## Feature 10: Multi-Niche Support

### Overview
Works in any niche - money, business, fitness, relationships, crypto, motivation, local services, personal brands.

### Implementation

#### Niche Configuration
```typescript
type NicheCategory = 
  | 'money' | 'business' | 'fitness' | 'relationships'
  | 'crypto' | 'motivation' | 'local_services' | 'personal_brand'
  | 'tech' | 'health' | 'education' | 'entertainment'
  | 'food' | 'travel' | 'fashion' | 'gaming';

interface NicheConfig {
  category: NicheCategory;
  displayName: string;
  icon: string;
  subNiches: string[];
  defaultPrompts: string[];
  viralFormats: string[];
  audienceDemographics: DemographicInfo;
  trendingTopics: string[];
  exampleKeywords: string[];
}

const NICHE_CONFIGS: Record<NicheCategory, NicheConfig> = {
  money: {
    category: 'money',
    displayName: 'Money & Finance',
    icon: '💰',
    subNiches: ['investing', 'saving', 'debt', 'crypto', 'real_estate'],
    defaultPrompts: ['Best investment for 2024', 'Money mistakes to avoid', 'How to budget'],
    viralFormats: ['hot_take', 'unpopular_opinion', 'confessions'],
    audienceDemographics: { ageRange: '25-45', interests: ['finance', 'wealth'], platformPreference: ['YouTube', 'TikTok'] },
    trendingTopics: ['inflation', 'recession', 'passive_income'],
    exampleKeywords: ['investing', 'saving money', 'crypto', 'real estate'],
  },
  // ... other niches
};
```

#### Adaptive Content Generation
```typescript
interface NicheAdaptiveGenerator {
  adaptStyle(content: ScriptContent, niche: NicheCategory): ScriptContent;
  adaptTone(content: ScriptContent, niche: NicheCategory): ScriptContent;
  addNicheSpecificElements(content: ScriptContent, niche: NicheCategory): ScriptContent;
  generateNicheQuestions(keyword: string, niche: NicheCategory): string[];
}
```

---

## Database Schema Summary

### New Tables Required
```sql
-- Self Clones
CREATE TABLE self_clones (...);

-- Clips table additions
ALTER TABLE clips ADD COLUMN clone_id UUID REFERENCES self_clones(id);
ALTER TABLE clips ADD COLUMN product_placement JSONB;
ALTER TABLE clips ADD COLUMN export_formats JSONB;
ALTER TABLE clips ADD COLUMN language VARCHAR(10);
ALTER TABLE clips ADD COLUMN duration_target INTEGER;

-- Episodes/Stitching
CREATE TABLE stitching_projects (...);
CREATE TABLE folders (...);
CREATE TABLE tags (...);
CREATE TABLE smart_collections (...);

-- Translations
CREATE TABLE translations (...);

-- Exports
CREATE TABLE exports (...);
```

---

## Implementation Priority (Excluding Consistent Characters)

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| 1 | Keyword-to-Viral | High | Medium |
| 2 | Interview Formats | High | Low |
| 3 | Multi-Language | High | High |
| 4 | Auto-Captions | High | Medium |
| 5 | Platform Export | High | Medium |
| 6 | Self-Cloning | Medium | Very High |
| 7 | Video Length Control | Medium | Low |
| 8 | Product Placement | Medium | Low |
| 9 | Library & Stitching | Low | High |
| 10 | Multi-Niche Support | Low | Medium |
