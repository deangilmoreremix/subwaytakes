# StreetSpeak AI - Complete Feature Implementation Plan

## Executive Summary

Build a comprehensive street interview video creation platform with AI-powered character consistency, multi-language support, viral content formats, and multi-platform export capabilities.

---

## Core Features Matrix

| Feature | Priority | Complexity | Status |
|---------|----------|------------|--------|
| Consistent Characters | P0 | High | Planned |
| AI Avatar Cloning | P0 | Very High | Planned |
| Keyword-to-Interview | P1 | High | Planned |
| Viral Conversation Styles | P1 | Medium | Planned |
| Interview Formats | P2 | Medium | Planned |
| Street Scene Generation | P2 | High | Planned |
| Video Length Control | P2 | Low | Partial |
| Product Placement | P3 | Medium | Planned |
| Multi-Niche Support | P2 | Low | Partial |
| Multi-Language Support | P2 | High | Planned |
| Auto-Captions | P1 | Medium | Partial |
| Clip Library | P1 | Medium | Planned |
| Multi-Platform Export | P2 | Medium | Planned |

---

## 1. Consistent Characters System

### User Stories
- As a creator, I want to create a character with custom looks so viewers recognize them
- As a creator, I want to save character presets so I can reuse them
- As a creator, I want to adjust emotions and expressions per clip

### Components Required

#### CharacterPresetSelector.tsx (New)
```typescript
interface CharacterPreset {
  id: string;
  name: string;
  // Visual attributes
  faceStyle: 'realistic' | 'cartoon' | 'minimal';
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  facialHair?: string;
  eyewear?: string;
  clothing: {
    top: string;
    bottom: string;
    accessories: string[];
  };
  // Emotional range
  defaultExpression: 'neutral' | 'happy' | 'serious' | 'surprised';
  expressions: Record<string, string>; // emotion -> image URL
}

interface CharacterAttributes {
  ageRange: 'young' | 'middle' | 'older';
  gender: 'male' | 'female' | 'non-binary';
  ethnicity: string;
  bodyType: 'slim' | 'average' | 'athletic' | 'plus';
  styleVibe: 'casual' | 'professional' | 'streetwear' | 'formal';
}
```

#### CharacterLibrary.tsx (New)
- Grid view of saved characters
- Create new character modal
- Edit existing character
- Delete character
- Set default character

#### CharacterPreview.tsx (New)
- Real-time preview of character
- Expression toggles
- Outfit selector
- Lighting preview

### Database Schema Extensions
```sql
-- Character presets table
CREATE TABLE character_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  attributes JSONB NOT NULL,
  outfit_config JSONB NOT NULL,
  expression_images TEXT[], -- URLs to expression variants
  is_default BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Character usage tracking
CREATE TABLE character_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID REFERENCES character_presets(id),
  clip_id UUID REFERENCES clips(id),
  expressions_used TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. AI Avatar Cloning System

### User Stories
- As a creator, I want to upload one photo to create my AI clone
- As a creator, I want my clone to have my style and mannerisms
- As a creator, I want to generate videos without being on camera

### Technical Architecture

#### AvatarCloneService.ts (New)
```typescript
interface AvatarCloneRequest {
  sourceImage: File;
  style: 'realistic' | 'stylized' | 'minimal';
  attributes?: {
    ageAdjustment?: number;
    expressionRange?: string[];
  };
}

interface AvatarCloneResult {
  cloneId: string;
  generatedImages: string[]; // Multiple angles/expressions
  qualityScore: number;
  status: 'processing' | 'ready' | 'failed';
}

class AvatarCloneService {
  async createClone(request: AvatarCloneRequest): Promise<AvatarCloneResult>;
  async getCloneStatus(cloneId: string): Promise<AvatarCloneResult>;
  async generateExpression(cloneId: string, expression: string): Promise<string>;
  async deleteClone(cloneId: string): Promise<void>;
}
```

#### FaceDetection.ts (New)
```typescript
interface FaceData {
  landmarks: {
    eyes: [x: number, y: number][];
    nose: [x: number, y: number][];
    mouth: [x: number, y: number][];
    jawline: [x: number, y: number][];
  };
  attributes: {
    age: number;
    gender: string;
    emotion: string;
    beauty: number;
  };
  quality: {
    sharpness: number;
    brightness: number;
    occlusion: string[];
  };
}
```

#### ClonePreview.tsx (New)
- Upload photo interface
- Progress indicator during generation
- Result gallery
- Quality metrics display
- Regeneration options

### External Services Required
- **Face Detection API**: Face++ or AWS Rekognition
- **Face Generation**: Stable Diffusion + LoRA fine-tuning
- **Video Synthesis**: Wav2Lip or SadTalker

---

## 3. Keyword-to-Interview Generation Engine

### User Stories
- As a creator, I want to enter one keyword and get viral street interviews
- As a creator, I want natural questions and answers, not scripted content
- As a creator, I want multiple variations from one keyword

### InterviewGenerationService.ts (New)
```typescript
interface KeywordRequest {
  keyword: string;
  niche: string;
  tone: 'casual' | 'professional' | 'controversial' | 'humorous';
  length: 'short' | 'medium' | 'long';
  language: string;
  style: ConversationStyle;
}

interface GeneratedInterview {
  id: string;
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  estimatedDuration: number;
  viralScore: number;
  trendingElements: string[];
}

interface InterviewQuestion {
  id: string;
  text: string;
  type: 'hook' | 'main' | 'follow-up' | 'pivot';
  emotionalTriggers: string[];
  expectedAnswerLength: number;
}

interface InterviewAnswer {
  speaker: 'host' | 'guest';
  content: string;
  suggestedExpression: string;
  captionEmphasis: string[];
}
```

### NicheTemplates.ts (New)
```typescript
const NICHE_TEMPLATES: Record<string, {
  keywords: string[];
  hotTopics: string[];
  commonPhrases: string[];
  emotionalTriggers: string[];
}> = {
  money: {
    keywords: ['investment', 'side hustle', 'debt', 'salary', 'crypto'],
    hotTopics: ['passive income', 'financial freedom', 'money mistakes'],
    emotionalTriggers: ['fear', 'greed', 'envy', 'hope'],
  },
  fitness: {
    keywords: ['workout', 'diet', 'weight loss', 'muscle', 'health'],
    hotTopics: ['quick results', 'superfoods', 'gym tips'],
    emotionalTriggers: ['vanity', 'health anxiety', 'motivation'],
  },
  relationships: {
    keywords: ['dating', 'marriage', 'breakup', 'love', 'friendship'],
    hotTopics: ['red flags', 'dating advice', 'relationship goals'],
    emotionalTriggers: ['loneliness', 'heartbreak', 'hope'],
  },
  // ... more niches
};
```

---

## 4. Viral Conversation Styles System

### 10 Conversation Styles

| Style | Description | Best For | Avg Duration |
|-------|-------------|----------|--------------|
| **Hot Takes** | Provocative opinions on trending topics | Engagement, debate | 45-90s |
| **Callouts** | Direct questions calling out behaviors | Virality, shares | 30-60s |
| **Confessions** | Personal admissions, vulnerable moments | Trust, connection | 60-120s |
| **Red Flags** | Warning signs, dealbreakers | Education, awareness | 30-60s |
| **Street Quizzes** | Quick-fire random questions | Entertainment | 15-30s |
| **Would You Rather** | Binary choice scenarios | Debate, comments | 20-45s |
| **Truth or Dare** | Challenging personal questions | Drama, engagement | 45-90s |
| **Expert Takes** | Authority-building Q&A | Thought leadership | 60-120s |
| **Story Time** | Narrative experiences | Entertainment | 90-150s |
| **Myth Busters** | Debunking common misconceptions | Education | 45-90s |

### StyleSelector.tsx (New)
```typescript
interface ConversationStyle {
  id: string;
  name: string;
  icon: string;
  description: string;
  examplePrompt: string;
  viralElements: string[];
  typicalDuration: [number, number]; // min, max seconds
  emotionalTone: string[];
  bestNiches: string[];
}

const CONVERSATION_STYLES: ConversationStyle[] = [
  {
    id: 'hot_takes',
    name: 'Hot Takes',
    icon: '🔥',
    description: 'Provocative opinions that spark debate',
    examplePrompt: "What's your take on people who don't tip?",
    viralElements: ['controversy', 'polarization', 'comment bait'],
    typicalDuration: [45, 90],
    emotionalTone: ['defensive', 'passionate', 'agree/disagree'],
    bestNiches: ['money', 'dating', 'lifestyle'],
  },
  // ... 9 more styles
];
```

### StyleConfigurator.tsx (New)
- Style selection grid
- Custom prompt input
- Intensity slider (mild → spicy → nuclear)
- Target audience selector
- Expected reaction preview

---

## 5. Interview Format Options

### Format Types

| Format | Description | Use Case |
|--------|-------------|----------|
| **Solo** | Single speaker addressing camera | Thought leadership |
| **Face-to-Face** | Two people talking | Debate, discussion |
| **Reporter Style** | Interviewer asking questions | Traditional interview |
| **Full-Body Street** | Subject shown fully, street background | Authenticity, street credibility |
| **Reaction** | Split screen or picture-in-picture | Reacting to content |
| **Narrative** | Subject telling story to camera | Personal brand |

### FormatConfig.ts (New)
```typescript
interface InterviewFormat {
  id: string;
  name: string;
  visualLayout: 'single' | 'split' | 'pip' | 'full-body';
  cameraAngle: 'close-up' | 'medium' | 'wide' | 'over-shoulder';
  background: 'solid' | 'blur' | 'street' | 'studio';
  speakerVisibility: {
    host: boolean;
    guest: boolean;
  };
  transitionStyle: string;
}

const INTERVIEW_FORMATS: InterviewFormat[] = [
  {
    id: 'solo',
    name: 'Solo',
    visualLayout: 'single',
    cameraAngle: 'close-up',
    background: 'blur',
    speakerVisibility: { host: true, guest: false },
    transitionStyle: 'cut',
  },
  {
    id: 'face-to-face',
    name: 'Face-to-Face',
    visualLayout: 'split',
    cameraAngle: 'over-shoulder',
    background: 'street',
    speakerVisibility: { host: true, guest: true },
    transitionStyle: 'crossfade',
  },
  // ... more formats
];
```

---

## 6. Realistic Street Scene Generation

### StreetSceneGenerator.ts (New)
```typescript
interface StreetSceneConfig {
  location: 'soho' | 'harlem' | 'williamsburg' | 'times_square' | 'chelsea' | 'east_village';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  lighting: 'natural' | 'golden_hour' | 'neon' | 'overcast';
  crowdDensity: 'empty' | 'sparse' | 'moderate' | 'busy';
  weather: 'sunny' | 'cloudy' | 'rain' | 'snow';
  cameraMovement: 'static' | 'pan' | 'tilt' | 'dolly';
}

interface SceneElement {
  type: 'background' | 'foreground' | 'character' | 'props';
  id: string;
  position: { x: number; y: number };
  scale: number;
  zIndex: number;
}
```

### Scene Components
- Background rendering (street backgrounds)
- Character placement and layering
- Lighting and shadow effects
- Crowd simulation
- Weather effects

---

## 7. Video Length Control

### DurationConfig.ts (New)
```typescript
interface DurationConfig {
  minSeconds: number;
  maxSeconds: number;
  targetSeconds: number;
  platformOptimized: Platform[];
}

const PLATFORM_DURATIONS: Record<Platform, { min: number; max: number; ideal: number }> = {
  tiktok: { min: 8, max: 60, ideal: 30 },
  instagram: { min: 15, max: 90, ideal: 45 },
  youtube_shorts: { min: 8, max: 60, ideal: 45 },
  facebook: { min: 30, max: 120, ideal: 60 },
};
```

### LengthSelector.tsx (New)
- Slider for duration (8-160 seconds)
- Platform presets
- Estimated engagement metrics
- Segment markers

---

## 8. Product Placement Integration

### ProductPlacementConfig.ts (New)
```typescript
interface ProductPlacement {
  enabled: boolean;
  productName: string;
  productDescription: string;
  placementType: 'verbal' | 'visual' | 'both';
  integrationStyle: 'natural' | 'prominent' | 'subtle';
  callToAction: 'none' | 'link_in_bio' | 'mention' | 'demo';
}

interface NativeAdConfig {
  topicAlignment: number; // 0-1 how well product aligns with topic
  disclosureRequired: boolean;
  disclosureText?: string;
}
```

### ProductPlacementUI.tsx (New)
- Product name input
- Description/benefits
- Placement type selector
- Integration style slider
- CTA options
- Disclosure toggle

---

## 9. Multi-Niche Support

### NicheConfig.ts (New)
```typescript
const SUPPORTED_NICHES = [
  'money',
  'business',
  'fitness',
  'relationships',
  'crypto',
  'motivation',
  'local_services',
  'personal_brand',
  'health',
  'education',
  'entertainment',
  'politics',
  'sports',
  'food',
  'travel',
] as const;

type Niche = typeof SUPPORTED_NICHES[number];

interface NicheConfig {
  id: Niche;
  name: string;
  icon: string;
  trendingTopics: string[];
  commonPhrases: string[];
  targetAudience: string[];
  recommendedStyles: ConversationStyle['id'][];
}
```

### NicheSelector.tsx (New)
- Grid of niche icons
- Trending topics per niche
- Quick topic selection
- Niche-specific prompts

---

## 10. Multi-Language Support

### LanguageConfig.ts (New)
```typescript
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
] as const;

interface LanguageConfig {
  code: string;
  name: string;
  flag: string;
  scriptDirection: 'ltr' | 'rtl';
  availableVoices: string[];
}
```

### LanguageSelector.tsx (New)
- Language dropdown with flags
- Auto-translation toggle
- Voice selection
- RTL support for Arabic

---

## 11. Auto-Captions System

### CaptionConfig.ts (New)
```typescript
interface CaptionStyle {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  position: 'top' | 'bottom' | 'center';
  animation: CaptionAnimation;
  highlightWords: boolean;
  uppercase: boolean;
}

const VIRAL_CAPTION_STYLES: CaptionStyle[] = [
  {
    id: 'tiktok',
    name: 'TikTok Viral',
    fontFamily: 'Montserrat',
    fontSize: 24,
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.7)',
    position: 'bottom',
    animation: 'word_by_word',
    highlightWords: true,
    uppercase: false,
  },
  {
    id: 'youtube',
    name: 'YouTube Classic',
    fontFamily: 'Roboto',
    fontSize: 28,
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0)',
    position: 'bottom',
    animation: 'static',
    highlightWords: false,
    uppercase: false,
  },
  // ... more styles
];
```

### CaptionCustomizer.tsx (New)
- Style presets dropdown
- Font selector
- Color pickers (text + background)
- Position toggle
- Animation selector
- Word emphasis toggle
- Preview panel

---

## 12. Clip Library & Video Stitching

### LibraryConfig.ts (New)
```typescript
interface ClipLibrary {
  id: UUID;
  name: string;
  clips: LibraryClip[];
  totalDuration: number;
  createdAt: Timestamp;
}

interface LibraryClip {
  id: UUID;
  thumbnailUrl: string;
  title: string;
  duration: number;
  niche: string;
  tags: string[];
  viralScore: number;
  createdAt: Timestamp;
}

interface StitchingConfig {
  clips: UUID[];
  transitions: TransitionType[];
  introClipId?: UUID;
  outroClipId?: UUID;
  totalDuration: number;
}
```

### LibraryPage.tsx (New)
- Grid view of saved clips
- Filter by niche, duration, date
- Search functionality
- Multi-select for stitching
- Bulk actions (delete, export)

### VideoStitcher.tsx (New)
- Timeline editor
- Clip ordering (drag & drop)
- Transition selection
- Preview with playback
- Export options

---

## 13. Multi-Platform Export

### ExportConfig.ts (New)
```typescript
interface ExportSettings {
  platform: Platform;
  format: 'mp4' | 'webm';
  resolution: '720p' | '1080p' | '4k';
  aspectRatio: '9:16' | '1:1' | '16:9';
  frameRate: 30 | 60;
  bitrate: 'low' | 'medium' | 'high';
  includeWatermark: boolean;
}

const PLATFORM_CONFIGS: Record<Platform, ExportSettings> = {
  tiktok: {
    platform: 'tiktok',
    format: 'mp4',
    resolution: '1080p',
    aspectRatio: '9:16',
    frameRate: 60,
    bitrate: 'high',
    includeWatermark: false,
  },
  instagram_reel: {
    platform: 'instagram_reel',
    format: 'mp4',
    resolution: '1080p',
    aspectRatio: '9:16',
    frameRate: 60,
    bitrate: 'high',
    includeWatermark: false,
  },
  youtube_shorts: {
    platform: 'youtube_shorts',
    format: 'mp4',
    resolution: '1080p',
    aspectRatio: '9:16',
    frameRate: 60,
    bitrate: 'high',
    includeWatermark: false,
  },
  facebook: {
    platform: 'facebook',
    format: 'mp4',
    resolution: '1080p',
    aspectRatio: '9:16',
    frameRate: 30,
    bitrate: 'medium',
    includeWatermark: true,
  },
};
```

### ExportModal.tsx (New)
- Platform presets
- Resolution selector
- Format options
- Watermark toggle
- Export progress
- Download/Copy link

---

## Implementation Phases

### Phase 1: Core Foundation
- [ ] Keyword-to-Interview engine
- [ ] 10 Viral Conversation Styles
- [ ] Auto-Captions (basic)
- [ ] Clip Library (basic)
- [ ] Database schema updates

### Phase 2: Visual Enhancement
- [ ] Consistent Characters system
- [ ] Interview Format options
- [ ] Street Scene Generation
- [ ] Video Length Control
- [ ] Product Placement

### Phase 3: AI Features
- [ ] AI Avatar Cloning
- [ ] Multi-Language Support
- [ ] Multi-Niche Templates
- [ ] Advanced caption styles
- [ ] Scene background rendering

### Phase 4: Platform & Distribution
- [ ] Multi-Platform Export
- [ ] Video Stitching
- [ ] Batch processing
- [ ] CDN integration
- [ ] Analytics dashboard

---

## API Endpoints Required

```
POST /api/generate/interview
POST /api/generate/captions
POST /api/characters
POST /api/avatars/clone
POST /api/export
GET /api/library
POST /api/stitch
GET /api/languages
POST /api/niches
```

---

## External Services Required

| Service | Purpose | Priority |
|---------|---------|----------|
| OpenAI GPT-4 | Content generation | Required |
| ElevenLabs | Voice synthesis | Required |
| Stability AI | Image generation | High |
| Face++ | Face detection | Medium |
| AWS S3 | Asset storage | Required |
| Cloudflare CDN | Video delivery | Required |
| FFMpeg | Video processing | Required |

---

## Success Metrics

- **Content Generation**: < 30 seconds per interview
- **Character Consistency**: > 95% visual match across clips
- **Multi-Language**: 12+ languages with native quality
- **Platform Export**: < 2 minutes per video
- **User Engagement**: +40% watch time vs baseline
- **Conversion**: +25% CTR on product placements
