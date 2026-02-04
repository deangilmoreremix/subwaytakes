# 🚇 SubwayTakes - Viral Video Creation Platform

A full-stack TypeScript application for creating viral short-form videos with AI-powered generation, advanced editing features, and multiple content modes.

## 🎯 Overview

SubwayTakes is a viral video creation platform inspired by the popular "Subway Takes" TikTok format. It enables users to create, manage, and generate short-form video content with:

- **Multiple Content Modes** - Wisdom interviews, motivational speeches, street interviews, subway content, and studio productions
- **AI-Powered Generation** - Integrated with MiniMax and Veo APIs for video generation
- **Advanced Effects** - Captions, lower thirds, intros/outros, graphics overlays, and thumbnail generation
- **Enhancement Features** - Crowd reactions, soundscapes, plot twists, polls, and more
- **Episode System** - Multi-shot episodes with beat-by-beat scripting
- **Interview Formats** - Solo, face-to-face, reporter, full-body, POV interviewer, and group formats
- **Multi-Language Support** - 12 languages for global content creation
- **Platform Export** - Export to TikTok, Instagram Reels, YouTube Shorts, Facebook, and more
- **Niche Categories** - 16 content niches for targeted viral content

---

## 📁 Project Structure

```
subwaytakes/
├── src/
│   ├── components/          # React components (60+ components)
│   │   ├── AgeGroupSelector.tsx
│   │   ├── BeatBuilder.tsx
│   │   ├── CompactEffectsBar.tsx
│   │   ├── CrowdReactionPanel.tsx
│   │   ├── EffectsCustomizeModal.tsx
│   │   ├── EffectsPreview.tsx
│   │   ├── JourneyBuilder.tsx
│   │   ├── PlatformPoll.tsx
│   │   ├── StreetCrowdPanel.tsx
│   │   ├── TransformationArcBuilder.tsx
│   │   └── ... (50+ more)
│   ├── lib/
│   │   ├── types.ts        # Complete TypeScript definitions
│   │   ├── clips.ts        # Clip creation logic
│   │   ├── promptEngine.ts # Prompt generation
│   │   ├── subwayJourneyEngine.ts
│   │   ├── streetJourneyEngine.ts
│   │   ├── motivationalEngine.ts
│   │   └── ... (10+ more)
│   ├── pages/
│   │   ├── CreatePage.tsx  # Main clip creation
│   │   ├── DashboardPage.tsx
│   │   ├── ClipPage.tsx
│   │   ├── EpisodeBuilderPage.tsx
│   │   └── LibraryPage.tsx
│   └── App.tsx
├── supabase/
│   ├── functions/         # Edge Functions
│   │   ├── generate-video/ # Video generation
│   │   ├── generate-script/ # Script generation
│   │   └── stitch-episode/ # Episode stitching
│   └── migrations/        # Database migrations
├── thumbnail-service/      # FFmpeg thumbnail service
└── plans/                 # Architectural plans
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- MiniMax API key (for video generation)
- Google AI API key (optional, for Veo)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd subwaytakes

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# Video Generation APIs
MINIMAX_API_KEY=your-minimax-key
GOOGLE_AI_API_KEY=your-google-key

# Optional Services
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-key
FFMPEG_SERVICE_URL=your-ffmpeg-service
```

---

## 🎬 Clip Types

The platform supports 5 distinct clip types, each with unique features and enhancements:

### 1. Wisdom Interview (55+)

**Target Audience:** Older adults seeking life advice and wisdom

**Features:**
- Gentle, direct, funny, or heartfelt tones
- Settings: Park bench, coffee shop, living room, library
- Topics: Retirement, relationships, life lessons, family

**Enhancement Presets:**
- Caption: Word-by-word animation
- Lower Third: Modern style
- Graphics: Progress bar, chapter markers
- Intro: Title card

### 2. Motivational

**Target Audience:** Self-improvement enthusiasts

**Features:**
- Speaker styles: Intense coach, calm mentor, hype-man, wise elder
- Settings: Gym, stage, outdoor, urban rooftop, office
- Camera: Dramatic push, slow orbit, tight closeup
- Lighting: Golden hour, dramatic shadows, moody backlit

**Enhancement Presets:**
- Caption: Highlight animation
- Intro: Viral hook
- Outro: CTA with subscribe button
- Graphics: Progress bar, viral emojis

### 3. Street Interview

**Target Audience:** Casual content consumers

**Features:**
- Scenes: Busy sidewalk, coffee shop, park bench, crosswalk
- Interview styles: Man-on-street, ambush, friendly chat, hot take
- Energy: Calm, conversational, high energy, chaotic
- Time of day: Early morning, rush hour, evening, late night

**Enhancement Presets:**
- Caption: Quick captions
- Lower Third: Classic style
- Graphics: Sound wave visualization
- Intro: Branding overlay

### 4. Subway Interview

**Target Audience:** Urban commuters, viral content fans

**Features:**
- Scenes: Platform waiting, inside train, train arriving
- 20+ NYC subway lines with personalities
- Crowd reactions: Agree, disagree, shocked, amused
- Soundscapes: Train rumble, announcements, footsteps

**Enhancement Presets:**
- Caption: Slide-in animation (top position)
- Lower Third: Minimal style
- Graphics: Progress bar
- Intro: Quick intro

### 5. Studio Interview

**Target Audience:** Professional content, podcasts

**Features:**
- Setups: Podcast desk, living room, minimalist stage
- Lighting: Three-point, dramatic key, soft diffused
- Guest count support (single or multi-person)

**Enhancement Presets:**
- Caption: Static (clean subtitles)
- Lower Third: Full detail (name, title, role)
- Intro: Title card
- Outro: Subscribe button + handle

---

## 🎤 Interview Styles (20 Total)

The platform supports 20 distinct interview styles for street and subway interviews:

### Original Styles (10)
| Style | Description | Prompt Keywords |
|-------|-------------|-----------------|
| Quick Fire | Rapid questions, punchy answers | rapid, energetic, punchy |
| Deep Conversation | Thoughtful, philosophical exchange | thoughtful, meaningful |
| Man on Street | Classic vox pop approach | casual, spontaneous |
| Ambush Style | Catch them off guard, raw reactions | surprised, unfiltered |
| Friendly Chat | Warm, conversational tone | warm, genuine |
| Hot Take | Bold opinions, controversial stances | bold, controversial |
| Confessional | Intimate, vulnerable sharing | vulnerable, authentic |
| Debate Challenge | Confrontational, defending positions | intellectual, point-counterpoint |
| Reaction Test | Testing responses to scenarios | genuine, authentic |
| Serious Probe | Investigative, pressing for truth | investigative, accountability |
| Storytelling | Narrative focus, personal stories | expressive, vivid |

### New Styles (10)
| Style | Description | Prompt Keywords |
|-------|-------------|-----------------|
| Unpopular Opinion | Share controversial takes | defending, pushback, conviction |
| Exposed/Callout | Reveal industry secrets | hidden truths, insider, whistleblowing |
| Red Flag Detector | Spot warning signs | skepticism, cautionary, pattern recognition |
| Hot Take React | React to trending topics | real-time, immediate, trending |
| Confessions | Share personal stories | intimate, emotional, therapeutic |
| Before & After | Transformation journey | dramatic change, personal growth |
| Finish Sentence | Complete the prompt | collaborative, creative completion |
| One Piece of Advice | Single powerful tip | memorable, impactful, wisdom |
| Would You Rather | Choose between options | preference, debate, polarization |
| Street Quiz | Test knowledge, trick questions | trivia, surprising, quiz show |

---

## 📹 Interview Formats

Define how the interview is framed visually:

| Format | Description | Use Case |
|--------|-------------|----------|
| Solo | Single subject, medium shot | Solo commentary |
| Face to Face | Interviewer + subject, two-shot | Standard interview |
| Reporter | Reporter with mic, handheld | Field reporting |
| Full Body | Subject full frame, street setting | Lifestyle content |
| POV Interviewer | First-person POV | Immersive perspective |
| Group | Multiple people, panel | Panel discussions |

---

## ⏱️ Video Length Control

Optimize video duration for different platforms:

| Preset | Duration | Description |
|--------|----------|-------------|
| Hook | 8-15s | Short, punchy, viral-ready |
| Quick | 15-30s | Brief but engaging |
| Standard | 30-60s | Balanced content |
| Deep | 60-90s | More detailed |
| Long Form | 90-160s | Full storytelling |

---

## 🌍 Multi-Language Support

Create content in 12 languages:

| Language | Native Name | Code |
|----------|-------------|------|
| English | English | en |
| Spanish | Español | es |
| French | Français | fr |
| German | Deutsch | de |
| Portuguese | Português | pt |
| Italian | Italiano | it |
| Japanese | 日本語 | ja |
| Korean | 한국어 | ko |
| Chinese | 中文 | zh |
| Hindi | हिन्दी | hi |
| Arabic | العربية | ar |
| Russian | Русский | ru |

---

## 🎨 Caption Styles

6 caption preset styles for different platforms:

| Style | Font Family | Font Size | Best For |
|-------|-------------|-----------|----------|
| Standard | Inter | 32px | General use |
| TikTok | Proxima Nova | 28px | TikTok/Reels |
| YouTube | Roboto | 36px | YouTube Shorts |
| Attention Grabber | Bold Sans | 40px | Viral content |
| Minimalist | Mono | 24px | Clean look |
| Custom | Configurable | 16-72px | Full control |

---

## 📤 Platform Export

Export to multiple platforms with optimized settings:

| Platform | Aspect Ratio | Max Duration | Resolution |
|----------|--------------|--------------|------------|
| TikTok | 9:16 | 180s | 1080x1920 |
| Instagram Reels | 9:16 | 90s | 1080x1920 |
| YouTube Shorts | 9:16 | 60s | 1080x1920 |
| Instagram Post | 1:1 or 4:5 | 60s | 1080x1080 |
| Facebook | 9:16 or 4:5 | 60s | 1080x1920 |
| YouTube Video | 16:9 | 600s | 1920x1080 |

---

## 🎯 Niche Categories

16 content niches for targeted viral content:

| Niche | Description | Keywords |
|-------|-------------|----------|
| Money | Finance, investing, wealth | crypto, business, passive income |
| Business | Entrepreneurship, marketing | startup, growth, strategy |
| Fitness | Health, workout, nutrition | gym, diet, exercise |
| Relationships | Dating, marriage, family | love, dating, parenting |
| Crypto | Blockchain, cryptocurrencies | bitcoin, defi, nft |
| Motivation | Self-improvement, inspiration | success, habits, goals |
| Local Services | Business for local areas | plumber, dentist, lawyer |
| Personal Brand | Content creator, influencer | audience, engagement |
| Tech | Software, gadgets, AI | ai, software, gadget |
| Health | Medical, wellness | fitness, mental health |
| Education | Learning, courses | course, learning, tutorial |
| Entertainment | Movies, music, pop culture | celebrity, movie, music |
| Food | Cooking, restaurants | recipe, restaurant, food |
| Travel | Tourism, destinations | vacation, travel, hotel |
| Fashion | Clothing, style | outfit, trend, style |
| Gaming | Video games, esports | game, gaming, streamer |

---

## 🛍️ Product Placement

Monetize your content with integrated product placement:

| Field | Description |
|-------|-------------|
| Product Name | Name of product/service |
| Product Description | What it does |
| Call to Action | CTA button text |
| Placement Style | Subtle, Moderate, Prominent |
| Integration Type | End card, Natural mention, Demonstration |
| Offer Code | Optional promo code |
| Affiliate Link | Optional affiliate link |

---

## 🔑 Keyword-to-Viral Generator

AI-powered keyword analysis for viral content:

**Features:**
- Enter a single keyword
- AI auto-selects best niche settings
- Generates relevant topics
- Suggests interview angles
- Estimates viral potential

**Niche-specific keyword suggestions:**
- Money: "best investments", "side hustles", "money mistakes"
- Fitness: "workout mistakes", "quick fitness tips", "gym hacks"
- Relationships: "dating red flags", "relationship advice", "marriage tips"
- And more for each niche category

---

## 🎬 Video Stitching

Create multi-clip episodes with intelligent stitching:

**Features:**
- Upload multiple clips
- Automatic ordering by duration
- Smooth transitions between clips
- Export as single video
- Preview before export

**Transition Types:**
- Fade
- Slide
- Zoom
- Blur
- Dissolve

---

## 👤 Self-Cloning Workflow

Create your digital twin for consistent content:

**Steps:**
1. **Upload Reference** - Upload a video of yourself
2. **AI Extraction** - AI extracts appearance features
3. **Generate Clips** - Create new content with your clone
4. **Review & Export** - Review and export final clips

**Benefits:**
- Consistent on-camera presence
- Scale content production
- Maintain personal brand
- Save time on filming

---

## ✨ Features

### Core Features

#### Clip Creation

- **Topic Selection** - Curated topics per clip type with custom option
- **Duration Control** - 2-8 second clips
- **Angle Input** - Custom direction prompts
- **Batch Mode** - Generate multiple variations (2-5 clips)

#### AI-Powered Generation

- **Keyword Input** - AI auto-selects best settings from single keyword
- **Smart Presets** - Pre-configured settings per clip type
- **Auto-Optimization** - Settings adjusted for viral potential

#### Video Effects System

**Captions:**
- Animation styles: Static, word-by-word, typewriter, karaoke, pop-up, slide-in, highlight
- Font size control (16-72px)
- Position: Top, bottom, center
- Emphasize words: Highlight specific terms

**Lower Thirds:**
- Styles: None, classic, modern, minimal, vintage
- Show/hide: Name, title, role
- Custom text support

**Intros:**
- Types: Hook, title, branding, countdown
- Duration control (frames)

**Outros:**
- Types: CTA, subscribe, next video, branding
- Subscribe button toggle
- Channel handle display

**Graphics:**
- Progress bar (video timeline)
- Chapter markers (sections)
- Viral emojis (animated reactions)
- Sound wave visualization

**Transitions:**
- Intro/outro transitions: Fade, slide, zoom, blur, dissolve

**Backgrounds:**
- Types: Solid, gradient, blur, video overlay
- Gradient presets: Sunset, Ocean, Purple, Forest, Dark, Neon

**Thumbnails:**
- Styles: Viral, quote, reaction, title
- Emoji picker
- Overlay text

### Enhancement Systems

#### Subway Enhancements

| Feature | Description |
|---------|-------------|
| Multi-Stop Journey | Multiple subway stops with narrative purposes |
| Crowd Reactions | Bystander agree/disagree/shocked reactions |
| Soundscapes | Train rumble, announcements, platform sounds |
| Plot Twists | Missed connections, train arrivals, interruptions |
| Platform Polls | Interactive agree/disagree polls |
| Train Arrival | Dramatic train arrival moments |
| Seasonal Context | Weather, holidays, city events |
| Transfer Points | Narrative pivots between lines |

#### Street Interview Enhancements

| Feature | Description |
|---------|-------------|
| Multi-Location Journey | Walking between locations |
| Crowd Dynamics | Bystander reactions and density |
| Urban Soundscapes | Traffic, construction, street performers |
| Plot Twists | Car horns, dogs, vendor interruptions |
| Street Polls | Interactive polling overlay |
| Neighborhood Personality | SoHo, Harlem, Williamsburg, etc. |
| Dramatic Moments | Rain, sun burst, light changes |
| Cross-Street Pivots | Question transitions |

#### Motivational Enhancements

| Feature | Description |
|---------|-------------|
| Transformation Arc | Before → During → After visual journey |
| Audience Energy | Crowd cheering, inspired reactions |
| Breakthrough Moments | Mic drops, mentor appears, camera freeze |
| Speaker Archetypes | Drill sergeant, Tony Robbins, Brené Brown style |
| Pause for Effect | Strategic silence with camera action |
| Live Challenges | 30-day challenge, hashtag display |
| Achievement Context | Championship, graduation, award ceremony |
| CTA Pivots | Story to advice, write this down, join movement |

#### Age-Appropriate Content

| Feature | Description |
|---------|-------------|
| Age Groups | Kids, teens, adults, older adults |
| Content Ratings | G, PG, PG-13, R |
| Topic Filtering | Appropriate topics per age group |
| Mode Restrictions | Interview modes filtered by age |

---

## 🎨 User Interface

### Main Pages

#### CreatePage

The primary clip creation interface with:
- Keyword input for AI-powered setup
- Clip type selector with visual cards
- Topic and duration selection
- Full effects customization panel
- Generation with progress status

#### DashboardPage

Overview of user's clips with:
- Recent clips grid
- Status tracking (queued, running, done, error)
- Viral score indicators
- Quick actions (view, reroll, delete)

#### EpisodeBuilderPage

Multi-shot episode creation:
- Beat-by-beat script editing
- Shot configuration
- Episode stitching workflow
- Progress tracking

#### LibraryPage

Content library with:
- Filterable clip grid
- Search functionality
- Sort options (date, viral score)
- Bulk actions

### Components

**70+ React Components** organized by feature:

**Core Selection Components**
- ClipTypeSelector, TopicSelector, DurationChips, AngleInput, FilterTabs

**Character Components**
- InterviewerSelector, SubjectSelector, CharacterPresetSelector, SpeakerArchetypeSelector

**Scene Components**
- SceneTypeSelector, CityStyleSelector, StreetSceneSelector, LightingMoodSelector, CameraStyleSelector

**Interview Style Components**
- InterviewStyleSelector, InterviewFormatSelector (NEW), InterviewModeSelector

**NEW Advanced Features**
- DurationSelector - Video length presets
- LanguageSelector - 12 language support
- CaptionStyleSelector - 6 caption presets
- PlatformExportSelector - Multi-platform export
- NicheSelector - 16 content niches
- KeywordGenerator - Keyword-to-viral analysis
- ProductPlacementPanel - Monetization features
- VideoStitcher - Multi-clip stitching
- SelfCloneManager - Digital twin workflow

**Enhancement Components**
- JourneyBuilder, CrowdReactionPanel, PlatformPoll, SoundscapeSelector
- PlotTwistSelector, TransformationArcBuilder, AudienceEnergyPanel
- BreakthroughMomentSelector, EventEnergyArc, LiveChallengeSelector
- PauseForEffect, AchievementContextSelector, CTAPivot

**Effects Components**
- CompactEffectsBar, EffectsCustomizeModal, EffectsPreview, RemotionEffects

**Utility Components**
- StatusCard, ErrorBoundary, TokenDisplay, ViralScoreCard
- RerollPanel, SeriesGroup, EpisodeCard

---

## 🗄️ Database Schema

### Core Tables

```sql
clips
├── id (UUID)
├── user_id (UUID)
├── video_type (enum)
├── topic (text)
├── duration_seconds (int)
├── result_url (text)
├── thumbnail_url (text)
├── status (enum: queued, running, done, error)
├── effects_config (jsonb)
├── viral_score (jsonb)
├── created_at (timestamptz)
└── [80+ enhancement fields]

episodes
├── id (UUID)
├── user_id (UUID)
├── status (enum)
├── total_duration_seconds (int)
├── final_video_url (text)
└── created_at (timestamptz)

episode_shots
├── id (UUID)
├── episode_id (UUID)
├── shot_type (enum)
├── sequence (int)
├── dialogue (text)
├── camera_direction (enum)
└── status (enum)

user_profiles
├── id (UUID)
├── username (text)
├── token_balance (int)
├── subscription_tier (enum)
└── created_at (timestamptz)
```

---

## 🔌 API Integration

### Supabase Edge Functions

#### generate-video

Generates videos using AI APIs:

```typescript
// Request
POST /functions/v1/generate-video
{
  clip_id: string;
  video_type: string;
  prompt: string;
  duration_seconds: number;
  model_tier?: 'standard' | 'premium';
  effects?: {
    thumbnail?: {
      enabled: boolean;
      style: string;
      emoji: string;
    };
  };
}

// Response
{
  success: true;
  clip_id: string;
  result_url: string;
  thumbnail_url: string;
}
```

#### generate-script

Generates scripts for episodes:

```typescript
POST /functions/v1/generate-script
{
  topic: string;
  cityStyle: string;
  interviewMode?: string;
}
```

#### stitch-episode

Stitches multiple shots into a single episode.

### External APIs

| API | Purpose | Status |
|-----|---------|--------|
| MiniMax | Primary video generation | ✅ Active |
| Google Veo | Secondary video generation | ✅ Active |
| Cloudinary | Thumbnail generation (optional) | 🔶 Optional |
| FFmpeg Service | Advanced thumbnails | 🔶 Optional |

---

## 🔐 Authentication & Pricing

### Authentication

- Supabase Auth integration
- Email/password and social providers
- Session management

### Token System

| Tier | Monthly Tokens | Features |
|------|---------------|----------|
| Free | 10 | Basic generation |
| Creator | 100 | + Batch mode |
| Pro | 500 | + All enhancements |
| Studio | Unlimited | + Priority rendering |

### Reroll System

Spice up existing clips:
- **Mild** - Subtle changes
- **Medium** - Noticeable variations
- **Spicy** - Controversial angles
- **Nuclear** - Maximum engagement

Preserve: Topic, setting, characters, duration
Enhance: Energy, controversy, humor, emotion

---

## 🛠️ Development

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| State | React Hooks, useReducer |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Auth | Supabase Auth |
| Deployment | Vercel (frontend), Supabase (backend) |
| Video APIs | MiniMax, Google Veo |

### Available Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build

# Linting & Type Checking
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler

# Database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed sample data
```

### Code Style

- ESLint with TypeScript configuration
- Prettier for formatting
- Conventional commits
- Component naming: PascalCase

---

## 📦 Deployment

### Frontend (Vercel)

```bash
# Connect repo to Vercel
vercel --prod

# Environment variables (Vercel Dashboard)
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### Backend (Supabase)

```bash
# Deploy Edge Functions
supabase functions deploy generate-video
supabase functions deploy generate-script
supabase functions deploy stitch-episode

# Run migrations
supabase db push
```

### Thumbnail Service (Optional)

```bash
# Deploy to Render/Railway
cd thumbnail-service
docker build -t thumbnail-service .
docker run -p 3001:3001 thumbnail-service
```

---

## 🔮 Future Enhancements

### Phase 2 (Planned)

- [ ] **Remotion Integration** - Server-side rendering with full effects
- [ ] **Advanced Thumbnails** - FFmpeg-powered custom thumbnails
- [ ] **Collaboration** - Team workspaces and shared libraries
- [ ] **Analytics** - View metrics, engagement tracking
- [ ] **Templates** - Save/load effect configurations
- [ ] **API Access** - Public API for third-party integrations

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

---

## 📄 License

MIT License - See LICENSE file for details.

---

## 🤝 Support

- **Documentation:** See `/docs` folder
- **Issues:** GitHub Issues
- **Discord:** Join our community server

---

## 📊 Project Stats

- **70+ React Components**
- **5 Clip Types**
- **20 Interview Styles** (10 new)
- **6 Interview Formats** (new)
- **5 Video Length Presets** (new)
- **12 Languages Supported** (new)
- **6 Caption Styles** (new)
- **6 Export Platforms** (new)
- **16 Content Niches** (new)
- **10+ Enhancement Systems**
- **3 Video API Integrations**
- **1000+ TypeScript Types**
- **15+ Database Migrations**

Built with ❤️ using React, TypeScript, Supabase, and Tailwind CSS.
