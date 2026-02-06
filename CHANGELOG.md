# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2024-02-06

### Added

- **Canonical Interview Style Registry** (`lib/interviewStyleSpecs.ts`)
  - New `InterviewStyleMeta` type with UI metadata and prompt hardening fields
  - All 21 interview styles with full hardening rules
  - Categories: Classic, Opinion, Story, Interactive, Investigative
  - Fields: `mustInclude`, `forbidden`, `structureRules`, `responseShape`

- **Style Rules Injector** (`lib/interviewStyleHardening.ts`)
  - `buildInterviewStyleHardening()` - converts metadata to prompt strings
  - `getInterviewStyleMeta()` - get style metadata by value
  - `isStyleSubwaySafe()` - check subway compatibility
  - `getRecommendedSeconds()` - get duration recommendations
  - `getStyleGoals()` - get best-for goals (comments, shares, saves, leads)

- **Prompt Hardening Integration** (`lib/promptEngine.ts`)
  - Interview style hardening wired into subway prompts
  - Card-mic compliance rules enforced

### Changed

- **UI Components Updated**
  - `InterviewStyleSelector.tsx` - uses new canonical registry
  - `InterviewCreator.tsx` - uses new canonical registry

- **Backward Compatibility**
  - `constants.ts` re-exports from new registry

### Features

**Interview Styles with Hardening Rules:**

| Style | Category | Hardening Highlights |
|-------|----------|---------------------|
| quick_fire | Interactive | Short Q&A, fast pacing, visible reactions |
| deep_conversation | Classic | Thoughtful pacing, one clear insight |
| man_on_street | Classic | One Q one A, spontaneous vibe |
| ambush_style | Interactive | Visible surprise, real hesitation |
| friendly_chat | Classic | Warm tone, smile/rapport |
| hot_take | Opinion | Strong stance first, no hedging |
| confessional | Story | Vulnerable tone, specific detail |
| confessions | Story | Clear reveal, emotional turn |
| debate_challenge | Opinion | Pushback, clear rebuttal |
| reaction_test | Interactive | Stimulus line, instant reaction |
| serious_probe | Investigative | Direct question, pressure pause |
| storytelling | Story | Vivid moment, clear arc |
| unpopular_opinion | Opinion | Contrarian stance, backlash bait |
| exposed_callout | Investigative | "Secret" premise, specific claim |
| red_flag_detector | Investigative | One flag, protective advice |
| hot_take_react | Opinion | Immediate take, final jab |
| before_after_story | Story | Before → turning point → after |
| finish_sentence | Interactive | Prompt completion, quick reaction |
| one_piece_advice | Story | One advice, quotable closer |
| would_you_rather | Interactive | Two options, forced choice |
| street_quiz | Interactive | Question, answer, reveal reaction |

### Example Hardening Output

For `quick_fire` style:

```
=== INTERVIEW STYLE HARDENING (Quick Fire) ===
MUST INCLUDE:
- one short question followed by a short answer
- fast pacing with minimal pauses
- reaction visible in face + hands
FORBIDDEN:
- long monologue
- slow reflective pacing
- multiple topics in one clip
HOOK: Start immediately on the question (no intro).
BEATS:
- Question lands
- Immediate answer
- Micro reaction / punchline
CLOSING: End right after the strongest line (no wrap-up).
```

---

[Unreleased]: https://github.com/deangilmoreremix/subwaytakes/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/deangilmoreremix/subwaytakes/releases/tag/v1.0.0
