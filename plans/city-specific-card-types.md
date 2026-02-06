# City-Specific Transit Card Types - Implementation Plan

## Overview
Implement city-specific transit card types for subway interviews, ensuring authenticity and brand consistency across all subway systems.

---

## Current State Analysis

### Existing City Styles
```typescript
type CityStyle = 'nyc' | 'london' | 'tokyo' | 'paris' | 'generic';
```

### Current CITY_VISUAL_CUES (in `promptEngine.ts`)
- NYC: MTA subway aesthetic, white tiles, colored trim, yellow safety line
- London: Underground, Mind the Gap, roundel logo, brown/cream tiles
- Tokyo: Ultra-clean, organized queues, digital screens, white lighting
- Paris: Art Nouveau, dark green railings, vintage tilework, narrow platforms
- Generic: Concrete pillars, fluorescent lighting, standard infrastructure

---

## Step 1: Define Transit Card Types

### New Type Definition
```typescript
export type TransitCardType =
  | 'metrocard'        // NYC
  | 'oyster'           // London
  | 'suica'            // Tokyo (also: Pasmo, ICOCA)
  | 'navigo'           // Paris
  | 'opal'             // Sydney
  | 'octopus'          // Hong Kong
  | 'ezlink'           // Singapore
  | 'ventra'           // Chicago
  | 'clipper'          // San Francisco
  | 'presto'           // Toronto
  | 'generic';         // Default
```

---

## Step 2: Create City-to-Card Mapping

### New Constants File: `transitCards.ts`

```typescript
import type { CityStyle, TransitCardType } from './types';

export const CITY_TRANSIT_CARDS: Record<CityStyle, TransitCardType> = {
  nyc: 'metrocard',
  london: 'oyster',
  tokyo: 'suica',
  paris: 'navigo',
  generic: 'generic',
};

export const CARD_DESCRIPTIONS: Record<TransitCardType, string> = {
  metrocard: 'New York MTA MetroCard - rectangular white plastic card with blue/orange stripe, tapped against the fare reader',
  oyster: 'London Underground Oyster card - distinctive brown rounded rectangular card with contactless symbol',
  suica: 'Japanese Suica/ICOCA/Pasmo - thin RFID card with cartoon character branding, tapped quickly',
  navigo: 'Paris Navigo card - rectangular card with weekly/monthly pass display window',
  octopus: 'Hong Kong Octopus card - orange-themed card with wave logo design',
  ezlink: 'Singapore EZ-Link - colorful card with heritage Singapore imagery',
  ventra: 'Chicago Ventra card - modern blue/white card with contactless payment',
  clipper: 'San Francisco Clipper card - navy blue card with Golden Gate bridge logo',
  presto: 'Toronto Presto card - distinctive red and white card design',
  generic: 'Generic transit card or ticket - plain rectangular card without prominent branding',
};

export const CARD_VISUAL_ANCHORS: Record<TransitCardType, string[]> = {
  metrocard: [
    'Interviewer holds MetroCard by the edge, tapping it against fare reader',
    'Card is visible in hand, showing the blue/orange stripe',
    'Casual NYC commuter gesture with the card',
  ],
  oyster: [
    'Interviewer shows Oyster card in palm, ready to tap',
    'Brown rounded card clearly visible between fingers',
    'Iconic London Underground gesture with the card',
  ],
  suica: [
    'Interviewer holds Suica card between thumb and finger',
    'Quick tap motion typical of Japanese transit users',
    'Card shows cute character design (if applicable)',
  ],
  navigo: [
    'Interviewer displays Navigo card showing pass window',
    'Card held to show the weekly/monthly validation strip',
    'Classic French transit card handling',
  ],
  octopus: [
    'Interviewer shows Octopus card with wave logo',
    'Orange card prominently displayed',
    'Hong Kong transit style card gesture',
  ],
  ezlink: [
    'Interviewer holds EZ-Link card with Singapore imagery',
    'Colorful card visible in frame',
    'Southeast Asian transit card handling',
  ],
  ventra: [
    'Interviewer displays Ventra card with Chicago skyline hint',
    'Modern blue/white card design visible',
    'Midwest transit card style',
  ],
  clipper: [
    'Interviewer shows Clipper card with Golden Gate logo',
    'Navy blue card prominently displayed',
    'Bay Area transit card gesture',
  ],
  presto: [
    'Interviewer holds Presto card with distinctive red/white design',
    'Ontario transit card handling',
    'Canadian transit card gesture',
  ],
  generic: [
    'Interviewer holds plain rectangular transit card',
    'Card used as microphone without specific branding',
    'Generic transit card or single-ride ticket',
  ],
};
```

---

## Step 3: Update Types

### In `types.ts`

```typescript
// Add after CityStyle type
export type TransitCardType =
  | 'metrocard'
  | 'oyster'
  | 'suica'
  | 'navigo'
  | 'octopus'
  | 'ezlink'
  | 'ventra'
  | 'clipper'
  | 'presto'
  | 'generic';

// Update GenerateRequest to include transitCard
export interface GenerateRequest {
  // ...existing fields
  transitCard?: TransitCardType;  // Add this - auto-populated from cityStyle
}
```

---

## Step 4: Update Prompt Constants

### In `promptEngine.ts`

#### Option A: Replace generic card references with city-specific ones

Update `SUBWAY_CARD_MIC_RULE` to be dynamic:

```typescript
export function getCardMicRule(cityStyle: CityStyle): string {
  const cardType = CITY_TRANSIT_CARDS[cityStyle];
  const cardDesc = CARD_DESCRIPTIONS[cardType];
  
  return `
MICROPHONE RULE (MANDATORY):
- The interviewer MUST hold a ${cardType} (${cardDesc}).
- The card is used AS the microphone and is clearly visible in the frame.
- The card is held in the interviewer's hand and extended toward the subject.
- NO traditional microphones, lavaliers, headsets, boom mics, or phones used as microphones.
- Camera framing must clearly show the card between interviewer and subject.
`.trim();
}
```

#### Option B: Keep existing rule but add city-specific anchors

Add to `CITY_VISUAL_CUES`:

```typescript
const CITY_VISUAL_CUES: Record<CityStyle, string> = {
  nyc: `New York City MTA subway aesthetic, white tile walls with colored trim, 
yellow platform edge safety line, classic NYC station signage, green globe lights at entrance.
INTERVIEWER CARD: Hold MetroCard - rectangular white plastic card with blue/orange stripe,
tapped against fare reader. Card is visible in hand showing the stripe.`,
  
  london: `London Underground aesthetic, rounded tunnel walls, Mind the Gap platform warning, 
roundel logo visible, deep escalators, brown and cream tiles.
INTERVIEWER CARD: Hold Oyster card - distinctive brown rounded rectangular card with 
contactless symbol, shown in palm ready to tap.`,
  
  tokyo: `Tokyo Metro aesthetic, ultra-clean platforms, organized queuing lines on floor, 
digital screens, bright white lighting, orderly commuters.
INTERVIEWER CARD: Hold Suica/ICOCA/Pasmo - thin RFID card, quick tap motion, 
card between thumb and finger.`,
  
  paris: `Paris Metro aesthetic, Art Nouveau entrance style, dark green railings, 
vintage tilework, Metropolitain signage, narrow platforms.
INTERVIEWER CARD: Hold Navigo card - rectangular card with weekly/monthly 
pass display window, displayed to show validation strip.`,
  
  generic: `Generic modern urban subway station, concrete pillars, fluorescent lighting, 
standard transit infrastructure.
INTERVIEWER CARD: Hold generic transit card - plain rectangular card without 
prominent branding, used as microphone.`,
};
```

---

## Step 5: Update Build Functions

### In `promptEngine.ts`

Update `buildEnhancedSubwayPrompt()`:

```typescript
function buildEnhancedSubwayPrompt(
  topic: string,
  duration: number,
  options: {
    // ...existing options
    transitCard?: TransitCardType;  // Add this
  }
): string {
  const {
    // ...existing destructuring
    transitCard,
  } = options;
  
  // Get city-specific visual cues (already includes card description)
  const cityVisuals = cityStyle ? CITY_VISUAL_CUES[cityStyle] : CITY_VISUAL_CUES.nyc;
  
  // Get card-specific visual anchors
  const cardType = transitCard || CITY_TRANSIT_CARDS[cityStyle || 'nyc'];
  const cardAnchors = CARD_VISUAL_ANCHORS[cardType];
  
  // Build the prompt with city-specific card references
  const basePrompt = `...`; // Existing base
  
  // Add card anchors
  if (cardAnchors) {
    basePrompt += `\n\nCARD MIC VISUAL ANCHORS:\n${cardAnchors.join('\n')}`;
  }
  
  return basePrompt;
}
```

---

## Step 6: Auto-Populate Transit Card from City

### In `clips.ts` or `promptEngine.ts`

```typescript
export function getTransitCardForCity(cityStyle: CityStyle): TransitCardType {
  return CITY_TRANSIT_CARDS[cityStyle];
}

// In createClip() or when building the request:
const transitCard = options.transitCard || getTransitCardForCity(options.cityStyle || 'nyc');
```

---

## Step 7: Update UI Components

### City Selector Updates

In components where `CityStyle` is selected, display card info:

```tsx
// Example in CityStyleSelector.tsx
<div className="text-sm text-amber-400 mt-2">
  💡 In {cityName}, interviewers use: {CARD_DESCRIPTIONS[cardType]}
</div>
```

### Card Type Display

Create a visual indicator showing the current card type when subway is selected:

```tsx
{selectedClipType === 'subway_interview' && selectedCityStyle && (
  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
    <p className="text-xs text-amber-400">
      🎫 Card Mic: {CARD_DESCRIPTIONS[CITY_TRANSIT_CARDS[selectedCityStyle]]}
    </p>
  </div>
)}
```

---

## Step 8: Consistency Check - All Subway Locations

### Files to Update

| File | Changes |
|------|---------|
| `src/lib/types.ts` | Add `TransitCardType` enum |
| `src/lib/constants.ts` | Add `CITY_TRANSIT_CARDS` mapping |
| `src/lib/promptEngine.ts` | Update prompts with card anchors |
| `src/lib/promptHardening.ts` | Add card-specific anchor helpers |
| `src/lib/clips.ts` | Auto-populate transit card from city |
| `src/components/CityStyleSelector.tsx` | Show card info |
| `src/components/InterviewCreator.tsx` | Add card display hint |
| `src/pages/CreatePage.tsx` | Update if needed |

---

## Implementation Order

1. **Add TransitCardType to types.ts**
2. **Create CITY_TRANSIT_CARDS and CARD_DESCRIPTIONS in constants.ts**
3. **Create CARD_VISUAL_ANCHORS in constants.ts**
4. **Update CITY_VISUAL_CUES to include card descriptions**
5. **Update buildEnhancedSubwayPrompt() to use card anchors**
6. **Add getTransitCardForCity() helper**
7. **Update createClip() to auto-populate transit card**
8. **Update UI components to show card info**
9. **Test all city/card combinations**

---

## Verification Checklist

- [ ] NYC → MetroCard anchor appears in prompts
- [ ] London → Oyster anchor appears in prompts
- [ ] Tokyo → Suica anchor appears in prompts
- [ ] Paris → Navigo anchor appears in prompts
- [ ] Generic → Plain card anchor appears
- [ ] UI shows correct card for selected city
- [ ] All existing functionality preserved
- [ ] TypeScript compilation passes
