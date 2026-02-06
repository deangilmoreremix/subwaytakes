# Clip Builder Wizard Redesign Plan

## Overview

Converting the current "one giant form" into a **4-step guided creation flow** to reduce cognitive load and improve conversion.

## New Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CreateInterviewWizard                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              WizardHeader (progress steps)           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │                  │    │                              │  │
│  │   Step Content   │    │     ClipSummaryCard          │  │
│  │   (centered)     │    │     (sticky, always visible)│  │
│  │                  │    │                              │  │
│  └──────────────────┘    └──────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Navigation (Back / Next)                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Step 1 — Interview Type Selection

### Current State
- `StepVideoType.tsx` exists with 5 video type cards

### Changes Needed
- Add "Best for" badges (shares/comments/saves) to each card
- Add auto-selection of defaults when type is selected
- Add preview label: "You're creating a Subway-style viral interview"

### New Types for State
```typescript
type StepId = 'type' | 'audience' | 'topic' | 'style' | 'summary';

interface Persona {
  id: string;
  label: string;
  emoji: string;
  description: string;
  ageGroup: AgeGroup;
  tone: EmotionalTone;
  guardrails: string[];
  defaultInterviewStyle: InterviewStyle;
}

interface VibePreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  durationRange: [number, number];
  energyLevel: EnergyLevel;
}

interface TopicOption {
  id: string;
  label: string;
  emoji: string;
  questions: string[]; // Pre-curated questions
}
```

### Step 1 Components
- **VideoTypeCard** - Enhanced with "Best for" badges
- **TypePreviewLabel** - Shows locked selection + defaults hint

## Step 2 — Audience & Vibe (NOT Settings)

### New Components
- **PersonaGrid** - 3-6 audience persona tiles
- **VibeChips** - Single-select vibe presets

### Persona Options
| ID | Label | Emoji | Description |
|----|-------|-------|-------------|
| `all_ages_viral` | All Ages | 🔥 | Viral takes for everyone |
| `adults_real_talk` | Adults | 🧑 | Real talk, no filter |
| `wisdom_55_plus` | 55+ Wisdom | 👵 | Life lessons & advice |
| `teens_opinions` | Teens | 🎓 | Bold opinions |
| `kids_friendly` | Kids | 🌟 | Family-friendly fun |

### Vibe Presets
| ID | Label | Emoji | Duration | Energy |
|----|-------|-------|----------|--------|
| `viral_punchy` | Viral & Punchy | ⚡ | 4-6s | high |
| `thoughtful_calm` | Thoughtful | 🧠 | 6-8s | calm |
| `bold_opinionated` | Bold | 🔥 | 3-5s | high |
| `emotional_heartfelt` | Heartfelt | ❤️ | 6-8s | calm |

### Behind the Scenes
When persona + vibe selected → auto-set:
- `ageGroup`
- `energyLevel`
- `durationSeconds`
- `interviewStyle` (default)
- Guardrails for content

## Step 3 — Topic & Question (Prompt Assist)

### New Components
- **TopicChips** - Grid of topic pills
- **QuestionList** - AI/curated questions per topic
- **SpiceChips** - Optional modifiers (spicy/gentle/funny/direct/serious)

### Topic Options (Curated)
| Topic | Emoji | Example Questions |
|-------|-------|------------------|
| Money | 💰 | "What's a money mistake you made?" |
| Relationships | 💕 | "What's relationship advice you'd give?" |
| Life Lessons | 🌱 | "What's a hard truth you learned?" |
| Career | 💼 | "What's career advice you'd give?" |
| Regrets | 😔 | "What's a regret you have?" |
| Happiness | 😊 | "What makes you happy?" |

### Step 3 Logic
1. User picks topic → show questions
2. User picks question → show optional "spice" modifiers
3. All selections → update state for prompt hardening

## Step 4 — Style & Review (Optional Override)

### Components
- **StyleGrid** - Interview style cards (from existing)
- **AdvancedDrawer** - Collapsible (collapsed by default)

### Advanced Settings (inside drawer)
- Model quality (standard/premium)
- Language dropdown
- Caption style
- Export platforms
- Product placement toggle
- Interview format icons

## Step 5 — Summary & Generate

### ClipSummaryCard (always visible, sticky right/bottom)
```
┌─────────────────────────────────┐
│ 📋 Clip Summary                 │
├─────────────────────────────────┤
│ 🎤 Type: Subway Interview       │
│ 👥 Audience: Adults - Real Talk│
│ 💬 Topic: Money Mistakes        │
│ ❓ Question: What's a hard...   │
│ ⏱️ Duration: 4-6s              │
│ 🎯 Vibe: Viral & Punchy        │
├─────────────────────────────────┤
│ ✅ Card mic enforced            │
│ ✅ Age-appropriate               │
└─────────────────────────────────┘
```

### Generate Button
```
┌─────────────────────────────────┐
│ 🟢 Generate My Clip            │
│ ⚡ ~30 seconds • 1 vertical    │
└─────────────────────────────────┘
```

## File Changes

### New Files to Create
1. `features/clipBuilder/steps/StepAudienceVibe.tsx`
2. `features/clipBuilder/steps/StepTopicQuestion.tsx`
3. `features/clipBuilder/ui/ClipSummaryCard.tsx`
4. `features/clipBuilder/ui/AdvancedDrawer.tsx`
5. `features/clipBuilder/data/personas.ts` - Persona presets
6. `features/clipBuilder/data/vibes.ts` - Vibe presets
7. `features/clipBuilder/data/topics.ts` - Topic + questions
8. `features/clipBuilder/wizardHardening.ts` - Prompt hardening logic

### Files to Modify
1. `features/clipBuilder/clipBuilder.types.ts` - Extended state model
2. `features/clipBuilder/ClipBuilderWizard.tsx` - New 4-step flow
3. `features/clipBuilder/steps/StepVideoType.tsx` - Enhanced cards
4. `features/clipBuilder/steps/StepInterviewStyle.tsx` - Simplified, moves to step 4

### Files to Delete (or deprecate)
- None - keep existing for fallback

## State Model (Updated)

```typescript
interface WizardState {
  // Step 1: Type
  videoType?: ClipType;

  // Step 2: Audience & Vibe
  personaId?: string;
  vibeId?: string;
  ageGroup?: AgeGroup;
  energyLevel?: EnergyLevel;

  // Step 3: Topic & Question
  topic?: string;
  interviewQuestion?: string;
  spiceTags?: string[];

  // Step 4: Style (optional override)
  interviewStyle?: InterviewStyle;

  // Advanced (collapsed)
  modelTier?: 'standard' | 'premium';
  language?: string;
  captionStyle?: CaptionStyle;
  exportPlatforms?: string[];
  productPlacement?: boolean;

  // Subway Card Mic (auto-set for subway)
  subwayCardMic?: SubwayCardMicConfig;

  // Derived flags
  enforceSubwayCardMic?: boolean;
  guardrails?: string[];
}
```

## Prompt Hardening Logic

### Step 1 Hardening (Type → Required Rules)
```typescript
function buildTypeHardRules(state: WizardState): string[] {
  const rules: string[] = [];

  if (state.videoType === 'subway_interview') {
    rules.push(SUBWAY_CARD_MIC_RULE.trim());
    rules.push(`
FRAMING RULE (MANDATORY):
- Card-mic must occupy ~8-12% of frame height
- Card visible in foreground plane
- No handheld mics, lavs, or boom poles
    `.trim());
  }

  return rules.join('\n\n');
}
```

### Step 2 Hardening (Persona → Guardrails)
```typescript
function buildPersonaSection(state: WizardState): string {
  if (state.personaId === 'wisdom_55_plus') {
    return WISDOM_SYSTEM_RULES.trim();
  }

  if (state.personaId === 'kids_friendly') {
    return `
KIDS SAFETY RULES (MANDATORY):
- No adult themes, dating, drugs, or explicit language
- Keep responses wholesome and educational
    `.trim();
  }

  return '';
}
```

### Step 3 Hardening (Topic → Structure)
```typescript
function buildDialogueStructure(state: WizardState): string {
  const q = state.interviewQuestion || `Ask about: ${state.topic}`;

  return `
DIALOGUE STRUCTURE (MANDATORY):
- Ask exactly one question: "${q}"
- Subject gives concise answer with clear opinion/story
- Include micro-beat: (pause / smirk / laugh / surprise)
- No rambling or abstract generalities
- Sound like a real person, not AI

ANTI-GENERIC RULE:
- Avoid "it depends", "be yourself", "follow dreams"
- Include 1 concrete detail (example, number, scenario)
  `.trim();
}
```

### Final Prompt Assembly
```typescript
function buildFinalProviderPrompt(state: WizardState): string {
  const parts: string[] = [];

  // 1. Type hard rules
  parts.push(buildTypeHardRules(state));

  // 2. Persona guardrails
  parts.push(buildPersonaSection(state));

  // 3. Dialogue structure
  parts.push(buildDialogueStructure(state));

  // 4. Spice modifiers
  if (state.spiceTags?.includes('spicy')) {
    parts.push('Push for controversial/unpopular answer');
  }

  // 5. Base prompt (existing engine)
  parts.push(existingGenerateRequest(state));

  return parts.filter(Boolean).join('\n\n---\n');
}
```

## Implementation Order

1. **Phase 1: Data & Types**
   - Create `personas.ts`, `vibes.ts`, `topics.ts`
   - Update `clipBuilder.types.ts`

2. **Phase 2: New Step Components**
   - Create `StepAudienceVibe.tsx`
   - Create `StepTopicQuestion.tsx`
   - Create `ClipSummaryCard.tsx`

3. **Phase 3: Wizard Shell**
   - Update `ClipBuilderWizard.tsx`
   - Add WizardHeader
   - Add navigation
   - Integrate ClipSummaryCard (sticky)

4. **Phase 4: Advanced & Generate**
   - Create `AdvancedDrawer.tsx`
   - Wire Generate button to existing engine

5. **Phase 5: Prompt Hardening**
   - Create `wizardHardening.ts`
   - Wire hardening into prompt engine

6. **Phase 6: Polish**
   - Add tooltips for first-time users
   - Add animation transitions
   - Test all flows

## Migration Path

Keep existing `InterviewCreator.tsx` working for backward compatibility. New users → guided wizard. Power users → can toggle to "Expert Mode" for old form.

## Success Metrics
- [ ] Time-to-generate reduced by 50%
- [ ] Completion rate improved
- [ ] Supabase errors reduced (better validation)
- [ ] Prompt quality improved (hardening rules)
