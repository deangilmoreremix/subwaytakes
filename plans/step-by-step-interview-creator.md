# Step-by-Step Interview Creator Design v2

## Overview

Enhanced 4-step wizard with **live video preview** and **episode-like connecting/extending** functionality. This will **replace the existing Episode Builder**.

---

## Step Flow (4 Steps)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1           Step 2           Step 3           Step 4                  │
│  [●] CREATE       [○] DETAILS      [○] CONNECT      [○] REVIEW              │
│                                                                             │
│  "What & How"     "Topic & Lang"   "Add to episode" "Ready to go!"          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PREVIEW                        │  TIMELINE (Episode View)          │    │
│  │  ┌─────────────────────────┐    │  ┌───┐ ┌───┐ ┌───┐ ┌───┐        │    │
│  │  │                         │    │  │ 1 │→│ 2 │→│ 3 │→│ + │        │    │
│  │  │   [ Live Preview ]      │    │  └───┘ └───┘ └───┘ └───┘        │    │
│  │  │                         │    │  0:15    0:30    0:45    +0:15   │    │
│  │  └─────────────────────────┘    │                                  │    │
│  │                                 │  [Connect multiple clips]         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: CREATE (What & How)

### UI Layout with Preview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: CREATE                                                              │
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │                             │  │  📺 LIVE PREVIEW                     │   │
│  │  🎬 What do you create?     │  │  ┌─────────────────────────────┐    │   │
│  │                             │  │  │                             │    │   │
│  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐   │  │  │     ╔═══════════════╗      │    │   │
│  │  │👴 │ │🎤 │ │🚇 │ │💪 │   │  │  │     ║               ║      │    │   │
│  │  │wis│ │str│ │sub│ │mot│   │  │  │     ║   PREVIEW     ║      │    │   │
│  │  │dom│ │eet│ │way│ │iva│   │  │  │     ║               ║      │    │   │
│  │  └───┘ └───┘ └───┘ └───┘   │  │  │     ║    AREA       ║      │    │   │
│  │                             │  │  │     ║               ║      │    │   │
│  │  🎤 How should it feel?     │  │  │     ╚═══════════════╝      │    │   │
│  │                             │  │  │                             │    │   │
│  │  🔥 Hot Take  💥 Unpopular  │  │  │  💡 Preview updates as you  │    │   │
│  │  🚩 Red Flag  ⚡ Hot React  │  │  │     configure settings       │    │   │
│  │  💎 One Advice  🤔 Would You│  │  │                                     │   │
│  │  ❓ Street Quiz  📖 Story   │  │  │  ┌─────────────────────────┐  │   │
│  │  🎤 Man on St  🎯 Quick     │  │  │  │ ⏱️ 0:15 │ 🎯 Solo     │  │   │
│  │                             │  │  │  └─────────────────────────┘  │   │
│  └─────────────────────────────┘  └─────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │ 📹 Format    │  ⏱️ Length   │  │ 🕐 Est. total: 0:45 (3 clips)       │   │
│  │ 🎯 Solo ▽    │  ⚡ 15-30s ▽ │  │                                      │   │
│  └─────────────────────────────┘  └─────────────────────────────────────┘   │
│                                                                             │
│                              [Continue →]                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 2: DETAILS (Topic & Language)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: DETAILS                                                            │
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐   │
│  │                             │  │  📺 LIVE PREVIEW                     │   │
│  │  💬 What's your topic?      │  │  ┌─────────────────────────────┐    │   │
│  │                             │  │  │                             │    │   │
│  │  🔍 Search topics...     ▽   │  │  │     ╔═══════════════╗      │    │   │
│  │                             │  │  │     ║               ║      │    │   │
│  │  Popular:                   │  │  │     ║   TOPIC:      ║      │    │   │
│  │  [💰 Money] [💼 Business]   │  │  │     ║   MONEY       ║      │    │   │
│  │  [💪 Fitness] [❤️ Dating]   │  │  │     ║               ║      │    │   │
│  │  [💻 Tech]   [🎮 Gaming]    │  │  │     ╚═══════════════╝      │    │   │
│  │                             │  │  │                             │    │   │
│  │  🌍 Language?               │  │  │  ┌─────────────────────────┐  │   │
│  │  🇺🇸 English             ▽   │  │  │  │ 🇺🇸 English • 0:15     │  │   │
│  │                             │  │  │  └─────────────────────────┘  │   │
│  │  [+ Custom Question]        │  │  │                                     │   │
│  │  [+ Add Direction]          │  │  │                                     │   │
│  │                             │  │  │                                     │   │
│  └─────────────────────────────┘  └─────────────────────────────────────┘   │
│                                                                             │
│  [< Back]                                            [Continue →]           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 3: CONNECT (Episode Builder Integration)

### Key Feature: Connect Multiple Clips into Episode

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: CONNECT                                                             │
│                                                                             │
│  This is where the Episode Builder functionality lives!                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📺 TIMELINE - Connect Your Clips                                    │    │
│  │                                                                      │    │
│  │  ┌───┐    ┌───┐    ┌───┐    ┌───┐    ┌───┐                        │    │
│  │  │ 1 │ →  │ 2 │ →  │ 3 │ →  │ 4 │ →  │ + │                        │    │
│  │  └───┘    └───┘    └───┘    └───┘    └───┘                        │    │
│  │   0:15     0:30     0:45     1:00     +0:15                       │    │
│  │                                                                      │    │
│  │  [🗑️ Clear All]  [🔗 Auto-Stitch]  [📝 Edit Transitions]           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📋 CLIP DETAILS (Selected: Clip 2)                                  │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │ 🎬 Type: Street Interview  │  🎤 Style: Hot Take              │   │    │
│  │  │ 💬 Topic: Money & Finance  │  🌍 Lang: English                │   │    │
│  │  │ ⏱️ Duration: 0:30          │  📹 Format: Solo                 │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  │  [✏️ Edit Clip]  [🗑️ Remove]  [↑ Move Up]  [↓ Move Down]           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🔗 TRANSITIONS (Connect clips)                                      │    │
│  │                                                                      │    │
│  │  Clip 1 → Clip 2:  [Fade ▽]    Clip 2 → Clip 3:  [Dissolve ▽]       │    │
│  │  Clip 3 → Clip 4:  [Zoom ▽]                                         │    │
│  │                                                                      │    │
│  │  [+ Add Transition]                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  [< Back]                         [Add Another Clip (+)]  [Continue →]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Connect Options

| Button | Action |
|--------|--------|
| **[+ Add Another Clip]** | Add new clip to timeline |
| **[🔗 Auto-Stitch]** | Auto-generate transitions between clips |
| **[📝 Edit Transitions]** | Custom transition editor |
| **[🗑️ Clear All]** | Remove all clips, start fresh |

### Timeline Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TIMELINE FEATURES                                                           │
│                                                                             │
│  Drag & Drop to reorder clips                                               │
│  Click to select and edit individual clip                                   │
│  Visual duration bars show relative lengths                                 │
│  Total episode time calculated automatically                                │
│  Transition connectors between clips                                        │
│  ✓ Valid - clips can connect                                                │
│  ✗ Invalid - conflicting settings detected                                  │
│                                                                             │
│  EXAMPLE:                                                                   │
│  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐                                     │
│  │ 1:15 │══▶│ 0:45 │══▶│ 1:00 │══▶│ +  │                                     │
│  └─────┘   └─────┘   └─────┘   └─────┘                                     │
│   Street    Confess   Hot Take   [Add]                                      │
│                                                                             │
│  Total: 3:00 │ 4 clips │ 3 transitions                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 4: REVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: REVIEW                                                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📺 EPISODE PREVIEW                                                  │    │
│  │                                                                      │    │
│  │  ┌───┐ → ┌───┐ → ┌───┐ → ┌───┐    Total: 3:00                      │    │
│  │  │ 1 │   │ 2 │   │ 3 │   │ 4 │                                     │    │
│  │  └───┘   └───┘   └───┘   └───┘                                     │    │
│  │   Street  Confess  Hot Take  Add                                    │    │
│  │                                                                      │    │
│  │  ▶️ Preview Episode   [↗️ Expand Full Screen]                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📤 EXPORT OPTIONS                                                   │    │
│  │                                                                      │    │
│  │  [✅] TikTok         📊 Est. reach: 50K-200K                         │    │
│  │  [✅] Instagram Reels 📊 Est. reach: 25K-100K                        │    │
│  │  [ ] YouTube Shorts                                                   │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │  🎬 Generate Episode (4 clips, ~3:00)                       │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  │  [Save Draft]  [< Back]                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Live Preview Panel
- Updates as user configures settings
- Shows topic, format, duration preview
- Visual indicators for selected options
- Thumbnail preview when available

### 2. Episode/Timeline Integration
- **Replaces Episode Builder**
- Add unlimited clips to timeline
- Visual drag-and-drop ordering
- Auto-calculate total duration
- Transition management between clips
- Individual clip editing
- Episode-level settings

### 3. Clip Management
```
┌─────────────────────────────────────────────────────────────┐
│  CLIP OPERATIONS                                            │
├─────────────────────────────────────────────────────────────┤
│  ✏️ Edit      - Open clip settings                          │
│  📝 Duplicate - Create copy of clip                         │
│  🗑️ Delete    - Remove from timeline                        │
│  🔗 Connect   - Link to previous/next clip                  │
│  ⏱️ Duration  - Adjust clip length                          │
│  ↕️ Reorder   - Drag to new position                        │
│  👁️ Preview   - Watch individual clip                       │
└─────────────────────────────────────────────────────────────┘
```

### 4. Episode Settings
```
┌─────────────────────────────────────────────────────────────┐
│  EPISODE SETTINGS                                           │
├─────────────────────────────────────────────────────────────┤
│  📝 Episode Title:    [____________________]                │
│  📝 Description:      [____________________]                │
│  🏷️ Category:         [Select ▽]                            │
│  🔒 Privacy:          [Public ▽]                            │
│  📅 Schedule:         [Publish now ▽]                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```
InterviewCreator/
├── CreatorContainer/
│   ├── ProgressBar.tsx
│   ├── StepIndicator.tsx
│   └── PreviewPanel.tsx
├── Steps/
│   ├── Step1_Create/
│   │   ├── ContentTypeCards.tsx
│   │   ├── InterviewStyleGrid.tsx
│   │   ├── FormatSelector.tsx
│   │   └── LengthSelector.tsx
│   ├── Step2_Details/
│   │   ├── TopicSelector.tsx
│   │   ├── LanguageSelector.tsx
│   │   └── OptionalFields.tsx
│   ├── Step3_Connect/
│   │   ├── TimelineView.tsx
│   │   ├── ClipCard.tsx
│   │   ├── TransitionEditor.tsx
│   │   └── EpisodeSettings.tsx
│   └── Step4_Review/
│       ├── EpisodePreview.tsx
│       ├── ExportOptions.tsx
│       └── GenerateButton.tsx
├── Timeline/
│   ├── TimelineTrack.tsx
│   ├── ClipNode.tsx
│   ├── TransitionConnector.tsx
│   └── DurationBar.tsx
└── index.tsx
```

---

## State Management

```typescript
interface CreatorState {
  currentStep: number;
  
  // Episode-level
  episodeId?: string;
  episodeTitle?: string;
  totalDuration: number;
  clips: Clip[];
  
  // Current clip being edited
  currentClipIndex: number;
  
  // Step 1: Create
  contentType: ContentType;
  interviewStyle: InterviewStyle;
  interviewFormat: InterviewFormat;
  durationPreset: DurationPreset;
  
  // Step 2: Details
  topic: string;
  language: SupportedLanguage;
  customQuestion?: string;
  additionalDirection?: string;
  
  // Step 3: Connect
  transitions: Transition[];
  
  // Step 4: Review
  exportPlatforms: ExportPlatform[];
  scheduledTime?: Date;
}

interface Clip {
  id: string;
  contentType: ContentType;
  interviewStyle: InterviewStyle;
  interviewFormat: InterviewFormat;
  durationPreset: DurationPreset;
  topic: string;
  language: SupportedLanguage;
  customQuestion?: string;
  additionalDirection?: string;
  thumbnailUrl?: string;
  status: 'draft' | 'generated' | 'error';
}

interface Transition {
  fromClipId: string;
  toClipId: string;
  type: 'fade' | 'dissolve' | 'slide' | 'zoom' | 'blur' | 'cut';
  duration: number;
}
```

---

## Migration from Episode Builder

### What Gets Replaced

| Old Component | New Location |
|---------------|--------------|
| EpisodeBuilderPage.tsx | Step 3: CONNECT |
| BeatBuilder.tsx | Timeline → Clip editing |
| EpisodeCard.tsx | Timeline → ClipNode |
| Stitch-episode function | Auto-Stitch button |

### What Gets Preserved

- All existing episodes remain accessible
- Import function for existing episodes
- Same export/stitch functionality
- Episode settings UI

---

## Benefits of Combined Design

| Feature | Before | After |
|---------|--------|-------|
| Clip creation | Separate flow | Inline with episode |
| Episode building | Separate page | Step 3 of wizard |
| Preview | Not available | Live preview panel |
| Transitions | Complex UI | Visual connectors |
| Time to episode | ~5 minutes | ~2 minutes |
| Clicks to create | ~20 | ~10 |

---

## Approval Required

1. **Is the preview panel placement correct?** (Right side during creation)
│   │   └── LengthSelector.tsx
│   ├── Step4_Details/
│   │   ├── TopicSelector.tsx
│   │   ├── LanguageSelector.tsx
│   │   └── CustomFields.tsx
│   ├── Step5_Enhance/
│   │   ├── EnhancementToggles.tsx
│   │   └── EnhancementDetails.tsx
│   ├── Step6_Export/
│   │   ├── PlatformSelector.tsx
│   │   └── MonetizationOptions.tsx
│   └── Step7_Review/
│       ├── ReviewSummary.tsx
│       └── GenerateButton.tsx
├── WizardNavigation/
│   ├── BackButton.tsx
│   ├── SkipButton.tsx
│   └── ContinueButton.tsx
└── index.tsx (Main component)
```

---

## State Management

```typescript
interface WizardState {
  // Step tracking
  currentStep: number;
  totalSteps: number;
  
  // Step 1: Content Type
  contentType: ContentType;
  
  // Step 2: Interview Style
  interviewStyle: InterviewStyle;
  
  // Step 3: Format & Length
  interviewFormat: InterviewFormat;
  durationPreset: DurationPreset;
  
  // Step 4: Details
  topic: string;
  language: SupportedLanguage;
  customQuestion?: string;
  additionalDirection?: string;
  
  // Step 5: Enhancements (optional)
  enhancements: {
    subway?: SubwayEnhancements[];
    street?: StreetEnhancements[];
    motivational?: MotivationalEnhancements[];
    visual?: VisualEnhancements[];
  };
  
  // Step 6: Export
  exportPlatforms: ExportPlatform[];
  monetization?: ProductPlacementConfig;
  scheduledTime?: Date;
  
  // Step 7: Review (computed)
  reviewComplete: boolean;
}
```

---

## User Experience Principles

### 1. Progressive Disclosure
- Show only what's needed at each step
- Advanced options hidden in accordions
- Users can expand for more control

### 2. Smart Defaults
- Pre-select based on:
  - User history/preferences
  - Content type best practices
  - Platform trends

### 3. Clear Feedback
- Selected items clearly highlighted
- Invalid selections show helpful errors
- Generation progress displayed

### 4. Flexibility
- Can navigate back to edit any step
- "Save Draft" to continue later
- "Quick Mode" for power users

---

## Implementation Phases

### Phase 1: Core Wizard (MVP)
- Steps 1-4 implemented
- Basic navigation
- Core content types

### Phase 2: Advanced Features
- Steps 5-7 implementation
- All enhancement options
- Export platforms

### Phase 3: Polish & Optimize
- Animations and transitions
- Keyboard navigation
- Accessibility improvements
- A/B testing for conversion

---

## Migration from Current Design

### Backward Compatibility
- Current CreatePage preserved as "Advanced Mode"
- Users can toggle between Wizard and Advanced
- Settings sync between modes

### Gradual Rollout
- Default to Wizard for new users
- "Try new creator" opt-in for existing users
- Gradual increase in Wizard percentage

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Completion rate | +25% vs current |
| Time to first clip | -40% |
| User satisfaction | +30% |
| Support tickets | -50% |

---

## File Locations

| File | Path |
|------|------|
| Wizard Component | `src/components/InterviewWizard/` |
| New Page | `src/pages/WizardPage.tsx` |
| Route | `/create/wizard` |
| Styles | `src/index.css` (wizard classes) |

---

## Approval Required

Please review this design and provide feedback on:

1. **Step Flow**: Are 7 steps appropriate or should we combine any?
2. **UI Layout**: Does the layout communicate clearly?
3. **Features**: Are all necessary options included?
4. **Migration**: Should we keep backward compatibility?
5. **Priorities**: Which phase should we start with?

