# SubwayTakes Interview Creator -- Product Requirements Document

**Document Type:** Snapshot Reference
**Application Version:** 0.0.0 (Pre-release)
**Date:** February 24, 2026

---

## 1. Product Overview

SubwayTakes Interview Creator is a web-based AI video clip generation platform that lets content creators produce short-form interview-style video clips across five distinct content formats. The platform handles the full lifecycle from creative configuration through AI generation to post-production enhancement and multi-platform export.

**Target Users:** Solo content creators, agency operators, and aspiring media entrepreneurs who want to produce viral-ready short-form video without a production crew.

**Core Value Proposition:** Transform a topic and a few creative choices into a publish-ready video clip in minutes, with configurable scene settings, character definitions, AI-generated scripts, post-production enhancements, and direct export formatting for TikTok, Instagram Reels, YouTube Shorts, and more.

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Routing | React Router DOM 7 |
| Database / Auth / Edge Functions | Supabase |
| Post-Production / Overlay Composition | Remotion 4 |
| Sanitization | DOMPurify |
| Containerization | Docker + Nginx |

---

## 3. Authentication and User Model

### 3.1 Authentication Flow

The application uses Supabase email/password authentication. A guest mode allows unauthenticated access with limited functionality. On first authentication, a `user_profiles` record is auto-created via upsert with 100 starting credits.

### 3.2 User Profile Schema

| Field | Type | Default |
|-------|------|---------|
| id | uuid (FK to auth.users) | -- |
| display_name | text (max 100 chars) | null |
| avatar_url | text | null |
| default_city_style | text | 'nyc' |
| default_duration | integer | 6 |
| credits_balance | integer (>= 0) | 100 |
| subscription_tier | text (free / pro / enterprise) | 'free' |

### 3.3 Subscription Tiers

Three tiers exist in the schema: **free**, **pro**, and **enterprise**. The Settings page displays the tier with color-coded badges (zinc for Free, amber for Pro, emerald for Enterprise). Credit balance is shown on the Dashboard and during clip generation.

---

## 4. Application Architecture

### 4.1 Navigation Structure

The application shell (`AppShell`) provides a collapsible left sidebar and a top header bar. The sidebar contains five primary navigation items:

| Nav Item | Route | Icon |
|----------|-------|------|
| Dashboard | /dashboard | LayoutDashboard |
| Create | /create | PlusCircle |
| Library | /library | Library |
| Templates | /templates | Palette |
| Analytics | /analytics | BarChart3 |

The sidebar footer shows the user's credit balance and subscription tier. The top header displays a dynamic page title, a Settings gear button, and a user avatar dropdown with profile info and sign out.

### 4.2 Route Map

| Route | Page | Description |
|-------|------|-------------|
| / | Redirect | Redirects to /create |
| /dashboard | DashboardPage | Overview with stats, activity, viral scores |
| /create | CreateHubPage | Selection hub for 5 creation modes |
| /create/subway | CreateSubwayPage | Subway interview wizard |
| /create/street | CreateStreetPage | Street interview wizard |
| /create/motivational | CreateMotivationalPage | Motivational clip wizard |
| /create/wisdom | CreateWisdomPage | Wisdom interview wizard |
| /create/studio | CreateStudioPage | Studio interview wizard |
| /library | LibraryPage | Content library with clips, episodes, compilations |
| /clips/:id | ClipPage | Individual clip detail and player |
| /clips/:id/enhance | EnhancePage | Post-production enhancement for clips |
| /episodes/new | EpisodeBuilderPage | 5-step episode creation wizard |
| /episodes/:id | EpisodePage | Episode detail with shot breakdown |
| /episodes/:id/enhance | EnhancePage | Enhancement for episodes |
| /compilations/new | CompilationBuilderPage | 3-step compilation builder |
| /compilations/:id | CompilationPage | Compilation detail and player |
| /compilations/:id/enhance | EnhancePage | Enhancement for compilations |
| /questions | QuestionBankPage | Question bank CRUD management |
| /templates | TemplateManagerPage | Video template management |
| /settings | SettingsPage | Profile and preferences |
| /analytics | AnalyticsPage | Performance analytics dashboard |
| /login | AuthPage | Sign in / Sign up |

All routes are lazy-loaded. No route guard exists; the application supports guest-mode browsing.

---

## 5. Content Types

### 5.1 Five Clip Types

| Type | Key | Accent Color | Tags |
|------|-----|-------------|------|
| Subway Interview | subway_interview | Amber | Viral, NYC, Authentic |
| Street Interview | street_interview | Emerald | Documentary, Vox Pop, Street |
| Motivational | motivational | Red | Cinematic, Inspiring, High Energy |
| Wisdom Interview | wisdom_interview | Amber | Heartfelt, Life Lessons, 55+ |
| Studio Interview | studio_interview | Sky | Professional, Podcast, Polished |

### 5.2 Episodes

Multi-shot productions composed of 6 sequential shots (cold_open, guest_answer, follow_up, reaction, b_roll, close). Each episode has a script, host/guest characters, city style, and generates individual shots that are stitched together.

### 5.3 Compilations

User-assembled sequences of existing clips stitched together with configurable transitions (crossfade, hard cut, dissolve) and adjustable transition duration.

---

## 6. Page-by-Page Wireframe Descriptions

### 6.1 Auth Page (/login)

```
+-------------------------------------------------------+
| DESKTOP: TWO-COLUMN SPLIT SCREEN                      |
|                                                       |
| +--LEFT PANEL (hidden mobile)--+ +--RIGHT PANEL----+ |
| |                               | |                 | |
| | [Film Icon]                   | | Sign In         | |
| | SubwayTakes                   | |                 | |
| |                               | | [Email Input]   | |
| | "Create viral interview       | | [Password Input]| |
| |  clips with AI"               | |                 | |
| |                               | | [Submit Button] | |
| | * AI-generated scripts        | |                 | |
| | * Multiple styles             | | "Don't have an  | |
| | * One-click export            | |  account? ..."  | |
| |                               | |                 | |
| | (gradient background blobs)   | | [Error Banner]  | |
| +-------------------------------+ +-----------------+ |
+-------------------------------------------------------+
```

**Left Panel:** Marketing branding with Film icon, "SubwayTakes" title, headline, and three feature bullets. Decorative gradient blobs in background. Hidden on mobile.

**Right Panel:** Centered form with mode toggle between "Sign In" and "Create Account". Email input with Mail icon prefix. Password input with Lock icon prefix and visibility toggle (Eye/EyeOff). Submit button with ArrowRight icon and loading spinner. Error banner (red) and success banner (green, post-signup) displayed conditionally. Text link at bottom toggles between modes.

---

### 6.2 Dashboard Page (/dashboard)

```
+-------------------------------------------------------+
| WELCOME BANNER                                         |
| +---------------------------------------------------+ |
| | "Good morning, [Name]"                             | |
| | "Here's an overview of your content studio."       | |
| |                                     [Token Badge]  | |
| +---------------------------------------------------+ |
|                                                       |
| STAT CARDS (4-col grid)                               |
| +----------+ +----------+ +----------+ +----------+  |
| | Total    | | Episodes | | Avg Viral| | This     |  |
| | Clips    | |          | | Score    | | Week     |  |
| | [value]  | | [value]  | | [value]  | | [value]  |  |
| +----------+ +----------+ +----------+ +----------+  |
|                                                       |
| QUICK ACTIONS (4-col grid)                            |
| [+ Create Clip] [Start Episode] [Stitch] [Library]   |
|                                                       |
| EXPLORE (4-col compact nav)                           |
| [Analytics] [Questions] [Templates] [Settings]        |
|                                                       |
| --------- divider ---------                          |
|                                                       |
| MAIN CONTENT (3-col: 2/3 + 1/3)                      |
| +--RECENT ACTIVITY (left 2 cols)--+--SIDEBAR--------+ |
| |                                  |                  | |
| | [Activity Item: clip row]        | VIRAL POTENTIAL  | |
| | [Activity Item: clip row]        | [#1 clip + bar] | |
| | [Activity Item: clip row]        | [#2 clip + bar] | |
| | [Activity Item: clip row]        | [#3 clip + bar] | |
| | [Activity Item: episode row]     |                  | |
| | [Activity Item: episode row]     | PRO TIP          | |
| |                                  | [< 1/6 >]       | |
| | TOKEN BALANCE (full display)     | [Tip title]     | |
| |                                  | [Tip text]      | |
| |                                  | [dot indicators]| |
| +---------------------------------+------------------+ |
|                                                       |
| --------- divider ---------                          |
|                                                       |
| CREATE NEW CONTENT (3-col card grid)                  |
| +--Subway----+ +--Street----+ +--Motivational-+      |
| | [icon]     | | [icon]     | | [icon]         |      |
| | title      | | title      | | title          |      |
| | subtitle   | | subtitle   | | subtitle       |      |
| | desc       | | desc       | | desc           |      |
| | [tags]     | | [tags]     | | [tags]         |      |
| +------------+ +------------+ +----------------+      |
| +--Wisdom----+ +--Studio----+                         |
| | ...        | | ...        |                         |
| +------------+ +------------+                         |
+-------------------------------------------------------+
```

**Welcome Banner:** Rounded card with gradient background and decorative blobs. Displays time-based greeting with user's display name. Token balance badge in top-right.

**Stat Cards:** 4-column responsive grid. Each card shows: icon in colored pill, uppercase label, large numeric value, subtitle. Cards: Total Clips (sky), Episodes (amber), Avg Viral Score (emerald, with conditional "Trending potential" text), This Week (rose). Loading state: 4 skeleton cards with pulse animation.

**Quick Actions:** 4-column grid of clickable cards. Each has a colored icon container, title, description, and hover-reveal arrow. Cards: Create New Clip (amber), Start Episode (sky), Stitch Clips (teal), Browse Library (emerald).

**Explore:** 4-column compact navigation buttons with icon + label + hover chevron. Links to Analytics, Questions, Templates, Settings.

**Recent Activity:** Card containing a list of activity rows. Each row shows: type-colored icon (spinning if processing), title with optional viral score badge, type + duration subtitle, status badge (Queued/Running/Generating/Stitching/Done/Error with colored dots), and relative timestamp. Empty state: centered Film icon with "No content yet" message.

**Viral Potential Sidebar:** Ranked list of top 5 clips with viral score >= 60. Each entry shows rank number, topic, score value, colored progress bar, and video type label. Empty state: TrendingUp icon with "No viral scores yet".

**Pro Tips Carousel:** Paginated tip cards with previous/next buttons, counter (1/6), dot indicators, and auto-advance every 12 seconds. Shows title and body text.

**Create New Content:** 3-column card grid with 5 creation mode cards. Each card has: colored gradient background, type icon, title, subtitle, description, tag pills. Hover effects: scale up, border highlight, arrow reveal.

---

### 6.3 Create Hub Page (/create)

```
+-------------------------------------------------------+
| "Create"                                               |
| "Choose a creation tool to get started."               |
|                                                       |
| CREATION MODE CARDS (3-col responsive grid)            |
| +--Subway Interview---+ +--Street Interview--+        |
| | [Train icon]        | | [Users icon]       |        |
| | "Subway Interview"  | | "Street Interview" |        |
| | "SubwayTakes viral  | | "Sidewalk          |        |
| |  style"             | |  documentary"      |        |
| | [description]       | | [description]      |        |
| | [Viral] [NYC]       | | [Documentary]      |        |
| | [Authentic]         | | [Vox Pop] [Street] |        |
| | "Start creating ->" | | "Start creating ->"  |      |
| +---------------------+ +--------------------+        |
| +--Motivational------+ +--Wisdom Interview--+        |
| | [Sparkles icon]    | | [Heart icon]       |        |
| | ...                | | ...                |        |
| +--------------------+ +--------------------+        |
| +--Studio Interview--+                               |
| | [Video icon]       |                               |
| | ...                |                               |
| +--------------------+                               |
|                                                       |
| INFO BOX                                              |
| [Sparkles] "AI Keyword Generator can auto-pick..."   |
+-------------------------------------------------------+
```

Each card is a clickable button with gradient background matching the clip type's accent color. Shows icon, title, subtitle (uppercase), description paragraph, tag pills, and hover-reveal "Start creating" link with arrow.

---

### 6.4 Creation Wizard (shared shell for all 5 clip types)

```
+-------------------------------------------------------+
| <- "All Creation Tools"    [Page Title]                |
| [Description text]                                    |
|                                                       |
| WIZARD SHELL                                          |
| +---------------------------------------------------+ |
| | STEP INDICATOR         [Settings Gear]             | |
| | (1)---(2)---(3)---(4)                              | |
| | Content Scene Enhance Generate                     | |
| +---------------------------------------------------+ |
| |                                                     | |
| | [ACTIVE STEP CONTENT]                               | |
| |                                                     | |
| +---------------------------------------------------+ |
| | [< Back]                    [Next >] or [Generate] | |
| +---------------------------------------------------+ |
|                                                       |
| ADVANCED SETTINGS DRAWER (overlay, right-slide)       |
| EFFECTS CUSTOMIZE MODAL (overlay)                     |
| QUICK GENERATE MODAL (overlay)                        |
+-------------------------------------------------------+
```

**Step Indicator:** Horizontal row of numbered circles connected by lines. Active step: colored ring. Completed: checkmark icon. Upcoming: dimmed. Step labels hidden on mobile.

**Navigation Bar:** Back button (disabled on first step) and Next/Generate button. Final step shows "Generate" with Zap icon; generates clip on click.

**Settings Gear:** Opens Advanced Settings Drawer (right-sliding panel).

---

### 6.5 Creation Wizard -- Step 1: Content (shared across all types)

```
+-------------------------------------------------------+
| AGE GROUP SELECTOR                                     |
| [Kids] [Teens] [Adults] [Older Adults] [All Ages]    |
|                                                       |
| --------- divider ---------                          |
|                                                       |
| TOPIC + DURATION (2-col)                              |
| +--Topic Selector------+ +--Duration Chips---+       |
| | [dropdown/select]     | | [3s][4s][5s]     |       |
| |                       | | [6s][8s]         |       |
| +-----------------------+ +------------------+       |
|                                                       |
| --------- divider ---------                          |
|                                                       |
| EFFECTS BAR                                           |
| [Selected effects summary]          [Customize btn]  |
|                                                       |
| --------- divider ---------                          |
|                                                       |
| AI KEYWORD GENERATOR (expandable)                     |
| [Wand2] "Use AI to pick settings"                    |
| (expanded: [KeywordInput component])                  |
|                                                       |
| --------- divider ---------                          |
|                                                       |
| [Zap] "Quick Generate" (bypasses wizard)             |
+-------------------------------------------------------+
```

**Age Group Selector:** Chip buttons for content rating targeting.

**Topic Select:** Dropdown with pre-populated topics per clip type. Subway type allows custom topics.

**Duration Chips:** Selectable chip buttons (3s, 4s, 5s, 6s, 8s).

**Compact Effects Bar:** Summary of selected Remotion effects with "Customize" button that opens the Effects Modal.

**AI Keyword Generator:** Toggle-expandable section. When expanded, shows keyword input that triggers AI analysis to auto-fill wizard settings.

**Quick Generate:** Button that opens the Quick Generate Modal showing default settings with "Generate with defaults" or "Customize" options.

---

### 6.6 Creation Wizard -- Subway Interview Steps

**Step 2: Subway Scene**

```
+-------------------------------------------------------+
| QUESTION INPUT                                         |
| [Text input for interview question]                   |
|                                                       |
| SCENE TYPE SELECTOR                                    |
| [Platform Waiting] [Inside Train] [Train Arriving]    |
| [Rush Hour] [Late Night] [Walking Through]            |
|                                                       |
| LOCATION SELECTOR (city style + custom text)          |
| [NYC] [London] [Tokyo] [Paris] [Generic] [Custom]    |
|                                                       |
| ENERGY LEVEL SELECTOR                                  |
| [Calm] [Conversational] [High Energy] [Chaotic]       |
|                                                       |
| INTERVIEW STYLE SELECTOR                               |
| [Quick Fire] [Deep Conversation] [Man on Street] ...  |
| (21 style options)                                    |
|                                                       |
| SUBWAY LINE SELECTOR                                   |
| [1][2][3] [4][5][6] [7] [A][C][E] ... [Any]          |
|                                                       |
| SCENARIO INPUT                                         |
| [Text area for scenario description]                  |
|                                                       |
| SOCIAL DYNAMICS PANEL                                  |
| Crowd Reaction: [Supportive][Skeptical][Curious][Mixed]|
| Passerby: [None][Light][Moderate][Heavy]              |
| Body Language: [Reserved][Natural][Animated][Dramatic] |
+-------------------------------------------------------+
```

**Step 3: Subway Enhancements**

```
+-------------------------------------------------------+
| ENHANCEMENT TOGGLE CARDS (2-col grid, accordion)       |
|                                                       |
| +--Multi-Stop Journey---+ +--Crowd Reactions----+     |
| | [Route] [toggle]      | | [Users2] [toggle]   |     |
| | (expanded: Journey    | | (expanded: Crowd    |     |
| |  Builder with stops)  | |  Reaction Panel)    |     |
| +-----------------------+ +---------------------+     |
|                                                       |
| +--Soundscape-----------+ +--Plot Twist---------+     |
| | [Volume2] [toggle]    | | [Shuffle] [toggle]  |     |
| +-----------------------+ +---------------------+     |
|                                                       |
| +--Platform Poll--------+ +--Train Arrival------+     |
| | [BarChart3] [toggle]  | | [Clock] [toggle]    |     |
| +-----------------------+ +---------------------+     |
|                                                       |
| +--Seasonal Context-----+ +--Transfer Point-----+     |
| | [Snowflake] [toggle]  | | [GitBranch] [toggle]|     |
| +-----------------------+ +---------------------+     |
|                                                       |
| CHARACTER SECTION                                      |
| Preset: [Podcast Pro][Street Vox][Documentary]...     |
| [Customize interviewer & subject details]              |
| (expanded: Interviewer type/position,                 |
|  Subject demographic/gender/style)                    |
+-------------------------------------------------------+
```

Each enhancement card uses a toggle + accordion pattern. Only one card expands at a time. All cards use amber accent color for subway type.

---

### 6.7 Creation Wizard -- Street Interview Steps

**Step 2: Street Scene**

```
+-------------------------------------------------------+
| STREET SCENE SELECTOR                                  |
| [Busy Sidewalk] [Coffee Shop] [Park Bench]            |
| [Crosswalk] [Shopping District] [Quiet Neighborhood]  |
|                                                       |
| INTERVIEW STYLE + TIME OF DAY (2-col)                  |
| +--Interview Style-----+ +--Time of Day--------+     |
| | [21 style options]   | | [Early Morning]     |     |
| |                      | | [Morning Rush]      |     |
| |                      | | [Midday] ...        |     |
| +----------------------+ +---------------------+     |
|                                                       |
| ENERGY LEVEL SELECTOR                                  |
| [Calm] [Conversational] [High Energy] [Chaotic]       |
|                                                       |
| SCENARIO INPUT                                         |
| [Text area]                                           |
|                                                       |
| SOCIAL DYNAMICS PANEL                                  |
| [Crowd Reaction] [Passerby] [Body Language]           |
+-------------------------------------------------------+
```

**Step 3: Street Enhancements**

```
+-------------------------------------------------------+
| NEIGHBORHOOD SELECTOR (standalone card)                |
| [SoHo] [Harlem] [Williamsburg] [FiDi]                |
| [Times Square] [Chelsea] [East Village]               |
|                                                       |
| ENHANCEMENT TOGGLE CARDS (2-col grid, emerald accent)  |
| [Multi-Location Journey] [Crowd Dynamics]              |
| [Urban Soundscape]       [Plot Twist]                  |
| [Street Poll]            [Dramatic Moment]             |
| [Seasonal Context]       [Cross-Street Pivot]          |
|                                                       |
| CHARACTER SECTION                                      |
+-------------------------------------------------------+
```

---

### 6.8 Creation Wizard -- Motivational Style Step

```
+-------------------------------------------------------+
| CORE SETTINGS CARD                                     |
| Speaker Style: [Intense Coach] [Calm Mentor]          |
|   [Hype Man] [Wise Elder] [Corporate Exec] [Athlete] |
|                                                       |
| Setting: [Gym] [Stage] [Outdoor] [Studio]             |
|   [Urban Rooftop] [Office] [Locker Room]              |
|                                                       |
| Camera Style + Lighting Mood (2-col)                   |
| +--Camera--------------+ +--Lighting-----------+     |
| | [Dramatic Push]      | | [Golden Hour]       |     |
| | [Slow Orbit]         | | [Dramatic Shadows]  |     |
| | [Tight Closeup]      | | [High Contrast]     |     |
| | [Wide Epic]          | | [Studio Clean]      |     |
| | [Handheld Raw]       | | [Moody Backlit]     |     |
| +----------------------+ +---------------------+     |
|                                                       |
| ENHANCEMENTS (2-col grid, red accent, 10 cards)       |
| [Transformation Arc]  [Audience Energy]                |
| [Soundscape]          [Breakthrough Moment]            |
| [Energy Arc]          [Live Challenge]                 |
| [Speaker Archetype]   [Pause for Effect]               |
| [Achievement Context] [CTA Pivot]                      |
+-------------------------------------------------------+
```

Motivational combines scene and enhancements into a single step. No separate character section (focuses on speaker archetype instead).

---

### 6.9 Creation Wizard -- Studio Setup Step

```
+-------------------------------------------------------+
| STUDIO SETUP SELECTOR                                  |
| [Podcast Desk] [Living Room] [Minimalist Stage]       |
| [Late Night] [Roundtable] [Fireside]                  |
| [News Desk] [Creative Loft]                           |
|                                                       |
| STUDIO LIGHTING SELECTOR                               |
| [Three Point] [Dramatic Key] [Soft Diffused]          |
| [Colored Accent] [Natural Window] [Cinematic]         |
|                                                       |
| CHARACTER SECTION                                      |
+-------------------------------------------------------+
```

The simplest creation step with just 2 selectors plus the shared character section.

---

### 6.10 Creation Wizard -- Wisdom Style Step

```
+-------------------------------------------------------+
| WISDOM FORMAT SELECTOR                                 |
| [Motivation] [Street Conversation] [Subway Take]      |
|                                                       |
| WISDOM TONE SELECTOR                                   |
| [Gentle] [Direct] [Funny] [Heartfelt]                |
|                                                       |
| WISDOM DEMOGRAPHIC SELECTOR                            |
| [Retirees] [Grandparents] [Late Career]              |
| [Caregivers] [Reinventors] [Mentors]                  |
|                                                       |
| WISDOM SETTING SELECTOR                                |
| [Park Bench] [Coffee Shop] [Living Room]              |
| [Library] [Main Street] [Subway Platform]              |
| [Community Center]                                    |
|                                                       |
| CHARACTER SECTION                                      |
+-------------------------------------------------------+
```

---

### 6.11 Creation Wizard -- Generate Step (shared final step)

```
+-------------------------------------------------------+
| SELECTION SUMMARY CARD                                 |
| +--Group: Content------+ [Edit pencil]                |
| | [Topic: X] [Duration: Ys] [Age: Z]                 |
| +--Group: Scene--------+ [Edit pencil]                |
| | [Scene: X] [Energy: Y] [Style: Z]                  |
| +--Group: Characters---+ [Edit pencil]                |
| | [Preset: X] [Interviewer: Y] [Subject: Z]          |
|                                                       |
| --------- divider ---------                          |
|                                                       |
| MODEL TIER SELECTOR                                    |
| [Standard (Hailuo)] [Premium (Veo)]                   |
|                                                       |
| SPEECH SCRIPT (optional)                               |
| [AI Generate Script] button                           |
| (expanded: 6-part script preview with                 |
|  HOST/GUEST/narrator labels, color-coded)             |
| [Use as Speech Script] [Copy]                         |
| [Speech script textarea, 2000 char max]               |
|                                                       |
| ADDITIONAL DIRECTION                                   |
| [Text input for creative direction]                   |
|                                                       |
| EFFECTS BAR                                           |
| [Summary] [Customize]                                 |
|                                                       |
| BATCH MODE (optional toggle)                           |
| [Toggle] Generate multiple clips                      |
| [2] [3] [5] [10] batch size chips                     |
|                                                       |
| --------- divider ---------                          |
|                                                       |
| [Zap] "Generate Clip" / "Generate N Clips"            |
|                                                       |
| STATUS CARD (shown during generation)                  |
| [Planning...] / [Generating...] / [Done] / [Error]   |
+-------------------------------------------------------+
```

**Selection Summary:** Groups of pill chips showing all prior selections with edit buttons that jump back to the relevant step.

**AI Script Generator:** Generates a 6-part script (hook question, guest answer, follow-up question, follow-up answer, reaction line, close punchline) with color-coded speaker labels.

---

### 6.12 Advanced Settings Drawer (global overlay)

```
+-------------------------------------------------------+
|                              +--DRAWER (right slide)--+|
|    (backdrop blur)           | Advanced Settings  [X] ||
|                              |                        ||
|                              | OUTPUT                 ||
|                              | Interview Format:      ||
|                              |  [Solo][Face to Face]  ||
|                              |  [Reporter][Full Body] ||
|                              |  [POV][Group]          ||
|                              | Duration Preset:       ||
|                              |  [Hook][Quick]         ||
|                              |  [Standard][Deep]      ||
|                              |  [Long Form]           ||
|                              | Caption Style:         ||
|                              |  [selector]            ||
|                              |                        ||
|                              | DISTRIBUTION           ||
|                              | Language: [12 options] ||
|                              | Export Platforms:       ||
|                              |  [multi-select]        ||
|                              |                        ||
|                              | AUDIENCE               ||
|                              | Niche: [16 categories] ||
|                              |                        ||
|                              | MONETIZATION           ||
|                              | Product Placement:     ||
|                              |  [config panel]        ||
|                              |                        ||
|                              | KEYWORDS               ||
|                              | [Keyword Generator]    ||
|                              |                        ||
|                              | [Done]                 ||
|                              +------------------------+|
+-------------------------------------------------------+
```

---

### 6.13 Library Page (/library)

```
+-------------------------------------------------------+
| "Library"                                              |
|                                                       |
| +---------------------------------------------------+ |
| | CONTENT MODE TABS                                   | |
| | [Clips] [Episodes] [Compilations]                  | |
| |                                                     | |
| | TOOLBAR (clips mode)                                | |
| | [Filter Tabs: All | Subway | Street | ...]         | |
| | [View: All | Series]  [Search...]  [Refresh]       | |
| |                                                     | |
| | CONTENT AREA                                        | |
| | (clips: ClipGrid or SeriesGroup)                   | |
| | (episodes: EpisodeCard list)                       | |
| | (compilations: row list with status badges)        | |
| |                                                     | |
| +---------------------------------------------------+ |
+-------------------------------------------------------+
```

**Content Mode Tabs:** Segmented control with Clapperboard/Film/Scissors icons. Active tab: amber background.

**Clips View:** Dual view modes (flat grid vs. series-grouped). ClipGrid component renders cards. Filter by clip type. Debounced search (300ms).

**Episodes View:** List of EpisodeCard components showing topic, duration, status, and shot count.

**Compilations View:** Row list showing name, duration, date, and color-coded status badges (Queued/Stitching/Complete/Error).

**Auto-polling:** Refreshes every 5 seconds when any item has a processing status.

---

### 6.14 Clip Detail Page (/clips/:id)

```
+-------------------------------------------------------+
| <- "Back to Create"                                    |
| "Clip Preview"  [Status Badge]  [Series Badge]  #id  |
|                                                       |
| TWO-COLUMN LAYOUT (2/3 + 1/3)                         |
| +--VIDEO (left 2 cols)--------+--DETAILS (right)----+ |
| |                              |                      | |
| | +------------------------+  | Status: [badge]      | |
| | |                        |  | Type: Subway         | |
| | |   9:16 VIDEO PLAYER    |  | Topic: [text]        | |
| | |   (max-h 600px)        |  | Duration: [N]s       | |
| | |                        |  | Scene: [type]        | |
| | |   or: Generating...    |  | City: [style]        | |
| | |   or: Error + Retry    |  | Energy: [level]      | |
| | |                        |  | Style: [interview]   | |
| | +------------------------+  | Created: [date]      | |
| |                              |                      | |
| | [ClipActions: Regen|Vary|Copy]| INTERVIEW QUESTION  | |
| | [VideoProcessingToolbar]     | [question card]      | |
| | [ViralScoreCard]             |                      | |
| | [RerollPanel]                |                      | |
| | [Enhance Video ->]           |                      | |
| | [Create Another Clip]        |                      | |
| +--------------+---------------+---------------------+ |
+-------------------------------------------------------+
```

**Video Area:** 9:16 aspect ratio player with three states: playing video, generating animation (spinning ring), or error display with retry button.

**Clip Actions:** Regenerate, Variation, Copy Link buttons.

**Viral Score Card:** Overall score with 5 component bars (Hook Strength, Emotional Arc, Shareability, Replay Value, Comment Bait) plus improvement suggestions.

**Reroll Panel:** Intensity selector (Mild/Medium/Spicy/Nuclear) with element preservation toggles.

**Details Sidebar:** Key-value metadata rows that vary by clip type. Interview question shown in amber-bordered card if present.

---

### 6.15 Episode Builder Page (/episodes/new)

```
+-------------------------------------------------------+
| <- "Back to Create"                                    |
| [Film] "Episode Builder"                               |
| "Create a full 6-shot SubwayTakes episode"             |
|                                                       |
| STEP INDICATOR                                         |
| (1)---(2)---(3)---(4)---(5)                           |
| Topic Script Beats Characters Preview                  |
|                                                       |
| STEP 1: TOPIC                                          |
| [TopicSelector] [CityStyleSelector]                   |
| Hook Question: [input + QuestionPicker]               |
| "Manage Question Bank" link                           |
| [Generate Script ->]                                  |
|                                                       |
| STEP 2: SCRIPT                                         |
| [ScriptEditor] -- review/edit generated script        |
|                                                       |
| STEP 3: BEATS                                          |
| [InterviewModeSelector]                               |
| [BeatBuilder] -- structure episode flow               |
|                                                       |
| STEP 4: CHARACTERS (2-col)                             |
| +--Host Character---+ +--Guest Character--+           |
| | gender, ethnicity | | gender, ethnicity |           |
| | age, clothing     | | age, clothing     |           |
| | energy persona    | | [Randomize]       |           |
| +-------------------+ +-------------------+           |
|                                                       |
| STEP 5: PREVIEW                                        |
| [Interview mode badge]                                |
| [TemplateSelector for branding]                       |
| Shot grid: [1][2][3][4][5][6] with names + durations  |
| Dialogue list with speaker labels                     |
| Stats: [Duration] [Est. Cost] [Est. Time]             |
| [Generate Episode ->]                                 |
|                                                       |
| GENERATING STATE                                       |
| [pulsing Film icon] "Creating Your Episode"           |
| [6 pulsing dots] estimated time                       |
+-------------------------------------------------------+
```

5-step wizard with numbered step indicator. Host and Guest characters shown in side-by-side cards. Preview step shows complete shot breakdown and cost estimate before final generation.

---

### 6.16 Episode Detail Page (/episodes/:id)

```
+-------------------------------------------------------+
| <- "Back to Library"                                   |
| [Episode Title]  [Status Badge]                        |
| [Hook question subtitle]                              |
| [Enhance] [Download] [Share] (when done)              |
|                                                       |
| PROGRESS BAR (when generating/stitching)               |
| [Film icon pulse] "Generating Shots" X/Y complete N%  |
| [=========>                                      ]    |
|                                                       |
| VIDEO PLAYER (when done)                               |
| [9:16 aspect, composed or raw video]                  |
| [Apply Branding button if template exists]            |
|                                                       |
| STATS (3-col)                                          |
| [Duration: Ns] [Shots: 6] [City: NYC]                |
|                                                       |
| SHOT BREAKDOWN                                         |
| +--Shot 1: cold_open-------+                          |
| | #1 | COLD OPEN | 6s | HOST | "dialogue..." | [ok] | |
| +--Shot 2: guest_answer----+                          |
| | #2 | GUEST ANSWER | 8s | GUEST | "dialogue" | [ok]| |
| +--Shot 3: follow_up------+                          |
| | ...                                                 | |
| +--Shot 6: close----------+                          |
| | #6 | CLOSE | 8s | HOST | "dialogue..." | [retry]  | |
|                                                       |
| [Caption download link]                               |
+-------------------------------------------------------+
```

Shot breakdown shows each of 6 shots with sequence number, type label, duration, speaker badge (host=blue, guest=emerald), dialogue text, and status icon (checkmark, spinner, clock, or retry button for errors).

---

### 6.17 Compilation Builder Page (/compilations/new)

```
+-------------------------------------------------------+
| <- "Back to Library"                                   |
| [Scissors] "Stitch Clips"                             |
|                                                       |
| STEP INDICATOR                                         |
| (1)---(2)---(3)                                       |
| Select Arrange Review                                  |
|                                                       |
| STEP 1: SELECT                                         |
| [CompilationClipSelector component]                   |
| +--FIXED BOTTOM BAR (when clips selected)--+          |
| | N clips selected | "Select at least 2"   |          |
| |                           [Next: Arrange] |          |
| +-------------------------------------------+          |
|                                                       |
| STEP 2: ARRANGE                                        |
| Name: [text input, auto-populated]                    |
| DRAG-AND-DROP LIST                                     |
| +--[grip] #1 [thumb] "Topic..." | Street | 5s  [X]--+ |
| +--[grip] #2 [thumb] "Topic..." | Subway | 6s  [X]--+ |
| +--[grip] #3 [thumb] "Topic..." | Studio | 4s  [X]--+ |
|                                                       |
| Transition: [Crossfade] [Hard Cut] [Dissolve]         |
| Duration: [---o--------] 0.3s (slider 0.1-1.0)       |
|                                                       |
| N clips | Total: XXs | [Back] [Next: Review]          |
|                                                       |
| STEP 3: REVIEW                                         |
| Summary: [Name] [N clips] [Duration] [Transition]    |
| Clip sequence list                                    |
| [Error area]                                          |
| [Zap] "Stitch Clips"                                 |
|                                                       |
| GENERATING STATE                                       |
| [pulsing Film icon] "Stitching Your Clips"            |
| [bouncing dots]                                       |
+-------------------------------------------------------+
```

3-step wizard. Step 2 features HTML5 drag-and-drop reordering with grip handles. Transition options include visual style cards and a range slider for duration.

---

### 6.18 Compilation Detail Page (/compilations/:id)

```
+-------------------------------------------------------+
| <- "Back to Library"                                   |
| [Compilation Name]  [Status Badge]  #id  [Retry?]    |
|                                                       |
| TWO-COLUMN (2/3 + 1/3)                                |
| +--VIDEO (left 2 cols)--------+--DETAILS (right)----+ |
| |                              |                      | |
| | [9:16 video player]          | STATS (3-col)       | |
| | or: stitching animation      | [Clips: N]          | |
| | or: error state              | [Duration: Xs]      | |
| |                              | [Transition: type]  | |
| | ACTIONS (when done)          |                      | |
| | [Download] [Enhance]         | CAPTION DOWNLOAD    | |
| | [Apply Branding]             | [SRT file link]     | |
| | [Delete (confirm)]           |                      | |
| |                              | CLIP BREAKDOWN      | |
| |                              | #1 [thumb] topic Ns | |
| |                              | #2 [thumb] topic Ns | |
| |                              | #3 [thumb] topic Ns | |
| |                              |                      | |
| |                              | Created: [date]     | |
| |                              | Completed: [date]   | |
| |                              |                      | |
| +------------------------------+---------------------+ |
|                                                       |
| [Create Another Compilation ->]                       |
+-------------------------------------------------------+
```

---

### 6.19 Enhance Page (/clips/:id/enhance, /episodes/:id/enhance, /compilations/:id/enhance)

```
+-------------------------------------------------------+
| <- "Back to [content type]"                            |
| [Sparkles] "Enhance Video"  [content title / type]    |
|                                                       |
| THREE-COLUMN LAYOUT (5/12 + 4/12 + 3/12)              |
| +--PREVIEW-----+--ENHANCEMENTS----+--EXPORT--------+ |
| |               |                   |                 | |
| | [9:16 video]  | PRESET BAR        | EXPORT PANEL   | |
| | (max-h 540)   | [Wisdom][Studio]  | [Platform      | |
| | ["Enhanced"   | [Subway][Street]  |  buttons by    | |
| |  badge]       | [Motivational]    |  aspect ratio] | |
| |               |                   |                 | |
| | [Apply        | ENHANCEMENT PANEL | Vertical 9:16: | |
| |  Enhancements]| [Watermark toggle]| [TikTok]       | |
| | [Download]    | [Lower Third]     | [IG Reel]      | |
| |               |  style/name/title | [YT Shorts]    | |
| |               | [Captions]        |                 | |
| |               |  animation style  | Square 1:1:    | |
| |               | [Background Music]| [IG Post]      | |
| |               |  track list       |                 | |
| |               |  volume slider    | Landscape 16:9:| |
| |               | [Sound Effects]   | [Facebook]     | |
| |               |  SFX list         | [YouTube]      | |
| |               | [Color Grade]     | [Twitter/X]    | |
| |               |  6 preset swatches|                 | |
| |               | [End Card]        | [Export to N    | |
| |               |  4 style options  |  platforms]     | |
| |               | [Progress Bar]    |                 | |
| +---------------+-------------------+-----------------+ |
+-------------------------------------------------------+
```

**Preset Bar (clips only):** Quick-apply buttons for each clip type that load preconfigured enhancement settings.

**Enhancement Panel:** 8 toggleable sections, each with enable/disable switch and expandable configuration:
- Watermark (simple toggle)
- Lower Third (style selector: Classic/Modern/Minimal/Vintage + name/title inputs)
- Captions (animation: Static/Word by Word/Typewriter/Karaoke/Pop Up)
- Background Music (scrollable track list with name/duration/BPM/mood + volume slider)
- Sound Effects (scrollable SFX list with name/duration/category)
- Color Grade (6-swatch grid: Original/Warm/Cool/Cinematic/Vintage/Dramatic)
- End Card (4 styles: Minimal/Branded/CTA/Subscribe)
- Progress Bar (simple toggle)

**Export Panel:** Platform buttons organized by aspect ratio. Each shows platform label, resolution, and status badge. Export action button triggers server-side processing.

---

### 6.20 Question Bank Page (/questions)

```
+-------------------------------------------------------+
| <- Back to Create                                      |
| [Flame] "Question Bank"                [Add Question] |
|                                                       |
| STATS (3-col)                                          |
| [Total: N] [Trending: N] [Custom: N]                  |
|                                                       |
| TOOLBAR                                                |
| [Search... (Enter)] [Category dropdown] [Trending btn]|
|                                                       |
| ADD QUESTION FORM (expandable)                         |
| [Question textarea]                                   |
| [Category] [Hook Type] [Energy Level] [Notes]         |
| [Cancel] [Add Question]                               |
|                                                       |
| QUESTION LIST                                          |
| +--Question Row---------------------------------------+|
| | [Trending badge] [Custom badge] [category] [hook]   ||
| | "What's the biggest lie you tell yourself?"          ||
| | [Usage: 12]  [Toggle Trending] [Edit] [Delete]      ||
| +-----------------------------------------------------+|
| +--Question Row---------------------------------------+|
| | ...                                                  ||
| +-----------------------------------------------------+|
+-------------------------------------------------------+
```

Full CRUD interface. Inline editing with check/cancel buttons. Trending toggle, category filtering, and search.

---

### 6.21 Template Manager Page (/templates)

```
+-------------------------------------------------------+
| <- Back to Create                                      |
| [Palette] "Video Templates"              [+ New]      |
| "Create and manage video overlay templates"            |
|                                                       |
| TEMPLATE GRID (3-col responsive)                       |
| +--Template Card----+                                  |
| | [Preview visual]  |                                  |
| | "SubwayTakes v1"  |                                  |
| | [Shield] [Default]|                                  |
| | 1080x1920 Inter 30fps                               |
| | [Edit/View]       |                                  |
| | [Duplicate] [Delete]                                 |
| +-------------------+                                  |
|                                                       |
| (when editing: full-page TemplateEditor replaces grid) |
+-------------------------------------------------------+
```

System templates show Shield icon and cannot be deleted. Cards display resolution, caption font, and FPS metadata.

---

### 6.22 Analytics Page (/analytics)

```
+-------------------------------------------------------+
| "Analytics"                                            |
| "Track your content creation performance"              |
|                         [7d] [30d] [90d] [All Time]   |
|                                                       |
| METRIC CARDS (4-col)                                   |
| [Clips Created N (+X%)] [Episodes N] [Avg Score N]    |
| [Exports N]                                           |
|                                                       |
| MAIN GRID (2/3 + 1/3)                                 |
| +--ACTIVITY CHART (left 2 cols)--+--STATUS BREAKDOWN-+ |
| | "Clip Generation Activity"      | "Generation Status"| |
| | [||||||||||||||||||||||||]       | Done: N (X%)      | |
| | (vertical bar chart, daily)     | Running: N (X%)   | |
| |                                  | Queued: N (X%)    | |
| |                                  | Error: N (X%)     | |
| +---------------------------------+-------------------+ |
|                                                       |
| BREAKDOWN GRID (3-col)                                 |
| +--By Video Type--+ +--Export Platforms-+ +--Top Clips-+ |
| | Subway: N [bar] | | TikTok: N [bar]  | | #1 topic 85| |
| | Street: N [bar] | | IG Reel: N [bar] | | #2 topic 72| |
| | Motivat: N [bar]| | YT Shorts: N     | | #3 topic 68| |
| | Studio: N [bar] | | ...              | | ...        | |
| | Wisdom: N [bar] | |                  | |            | |
| +-----------------+ +------------------+ +------------+ |
+-------------------------------------------------------+
```

**Time Range Selector:** Segmented pill control (7 days, 30 days, 90 days, All Time).

**Metric Cards:** 4-column grid with trend indicators (up arrow green, down arrow red, dash neutral).

**Activity Chart:** Vertical bar chart showing daily clip generation count with hover tooltips.

**Status Breakdown:** Progress bars for done/running/queued/error with percentages.

**Three-column breakdown:** Video type distribution, export platform distribution, and top clips by viral score.

---

### 6.23 Settings Page (/settings)

```
+-------------------------------------------------------+
| <- Back                                                |
| "Settings"                                             |
|                                                       |
| SECTION 1: PROFILE                                     |
| [User icon, amber] Profile                            |
| Display Name: [text input]                            |
| Subscription: [Tier Badge] | Credits: [N] remaining  |
| Email: user@example.com (or "Guest Mode")             |
|                                                       |
| SECTION 2: DEFAULT PREFERENCES                         |
| [MapPin icon, emerald] Default Preferences            |
| Default City Style:                                   |
| [NYC] [London] [Tokyo] [Paris] [Generic]              |
|                                                       |
| Default Duration:                                     |
| [3s] [4s] [5s] [6s] [8s]                             |
|                                                       |
| [Saved checkmark]                    [Save Changes]   |
+-------------------------------------------------------+
```

---

## 7. Data Model

### 7.1 Database Tables

| Table | Description | RLS |
|-------|-------------|-----|
| clips | Individual video clip records | Yes |
| episodes | Multi-shot episode records | Yes |
| episode_scripts | Script content for episodes | Yes |
| episode_shots | Individual shots within episodes | Yes |
| character_bibles | Character definitions (host/guest) | Yes |
| compilations | Clip compilation records | Yes |
| compilation_clips | Join table: clips in compilations | Yes |
| user_profiles | User preferences and credits | Yes |
| video_templates | Overlay/branding templates | Yes |
| video_exports | Platform export records | Yes |
| music_tracks | Background music library | Yes |
| sound_effects | Sound effect library | Yes |
| question_bank | Reusable interview questions | Yes |
| prompt_templates | AI prompt templates per video type | Yes |
| prompt_fragments | Reusable prompt building blocks | Yes |
| system_prompts | LLM system/user prompt configs | Yes |
| prompt_generation_logs | Audit log for prompt generation | Yes |

### 7.2 Entity Relationships

```
user_profiles (1) --- (*) clips
user_profiles (1) --- (*) episodes
user_profiles (1) --- (*) compilations
user_profiles (1) --- (*) video_exports
user_profiles (1) --- (*) character_bibles

episodes (1) --- (1) episode_scripts
episodes (1) --- (*) episode_shots
episodes (*) --- (1) character_bibles [host]
episodes (*) --- (1) character_bibles [guest]
episodes (*) --- (0..1) video_templates

compilations (1) --- (*) compilation_clips
compilation_clips (*) --- (1) clips

clips (*) --- (0..1) video_templates
video_templates (*) --- (0..1) music_tracks

prompt_generation_logs (*) --- (0..1) prompt_templates
prompt_generation_logs (*) --- (0..1) system_prompts
```

### 7.3 Clip Status Lifecycle

```
queued --> running --> done
                  \-> error
```

### 7.4 Episode Status Lifecycle

```
queued --> generating --> stitching --> done
                     \-> error     \-> error
```

### 7.5 Compilation Status Lifecycle

```
queued --> stitching --> done
                    \-> error
```

### 7.6 Overlay Composition Lifecycle

```
pending --> composing --> done
                      \-> error
                      \-> skipped
```

---

## 8. Edge Functions (Supabase)

| Function | Purpose |
|----------|---------|
| build-prompt | Assembles the final AI prompt from templates, fragments, and clip parameters |
| generate-script | AI-generates episode scripts (6-part structure) |
| generate-video | Triggers video generation via external provider (Hailuo/Veo) |
| process-video | Handles video processing callbacks and status updates |
| compose-overlay | Applies Remotion-based overlays (watermark, captions, lower thirds, etc.) |
| stitch-clips | Combines multiple clips into a compilation |
| stitch-episode | Stitches 6 episode shots into a final video |

---

## 9. AI Video Generation

### 9.1 Model Tiers

| Tier | Models | Use Case |
|------|--------|----------|
| Standard | hailuo-2.3-fast, hailuo-2.3 | Default generation, faster |
| Premium | veo-3.1-fast, veo-3.1 | Higher quality output |

### 9.2 Prompt Pipeline

1. User configures clip parameters through the creation wizard
2. `build-prompt` edge function assembles the prompt from:
   - Active `prompt_template` for the video type (base prompt + negative prompt)
   - Matching `prompt_fragments` for scene/camera/lighting/speaker categories
   - `system_prompt` for the video type (system + user prompt template)
   - User-provided parameters (topic, scene, energy, characters, etc.)
3. `generate-video` sends the assembled prompt to the video provider
4. `process-video` handles status callbacks and updates the clip record
5. Optionally, `compose-overlay` applies post-production enhancements

### 9.3 Viral Score System

Each clip receives a viral score with 5 components (0-100 each):
- **Hook Strength:** How well the first 2 seconds capture attention
- **Emotional Arc:** Presence and quality of emotional progression
- **Shareability:** Likelihood of social sharing
- **Replay Value:** Whether viewers will watch again
- **Comment Bait:** Potential to generate discussion

Suggestions for improvement are provided as a string array.

---

## 10. Credit System

Credits (tokens) are the internal currency for clip generation.

| Action | Credit Impact |
|--------|--------------|
| New user signup | +100 credits |
| Standard clip generation | Variable cost per clip |
| Premium clip generation | Higher cost than standard |
| Batch generation | Cost per clip in batch |
| Reroll (variation) | Cost per reroll |

Credit deduction is atomic (uses database RPC `deduct_credits_atomic` to prevent race conditions). Balance is displayed on the Dashboard, in the generation step's cost estimate, and on the Settings page.

---

## 11. Post-Production Enhancement System

### 11.1 Enhancement Configuration

| Feature | Options |
|---------|---------|
| Watermark | On/Off |
| Lower Third | Style (Classic/Modern/Minimal/Vintage), Name, Title |
| Captions | Animation (Static/Word by Word/Typewriter/Karaoke/Pop Up) |
| Background Music | Track selection from library, Volume (0-100%) |
| Sound Effects | SFX selection from library |
| Color Grade | None/Warm/Cool/Cinematic/Vintage/Dramatic |
| End Card | Style (Minimal/Branded/CTA/Subscribe) |
| Progress Bar | On/Off |

### 11.2 Per-Type Presets

Each clip type has a preconfigured enhancement preset:
- **Wisdom:** Word-by-word captions, warm grade, modern lower third, minimal endcard
- **Studio:** Static captions, cinematic grade, classic lower third, branded endcard
- **Subway:** Pop-up captions, no grade, minimal lower third, progress bar
- **Street:** Word-by-word captions, no grade, classic lower third
- **Motivational:** Karaoke captions, dramatic grade, CTA endcard, progress bar

### 11.3 Remotion Effects (Pre-Generation)

A separate effects system is applied during generation (not post-production):
- Caption configuration (7 animation styles, font/size/color/position)
- Lower third graphics (5 styles)
- Intro/Outro sequences (5 types each)
- Graphic overlays (progress bar, chapter markers, viral emojis, sound wave)
- Background settings (solid/gradient/blur/video overlay)
- Transition effects (fade/slide/zoom/blur/dissolve)
- Thumbnail generation (4 styles)

---

## 12. Export System

### 12.1 Supported Platforms

| Platform | Aspect Ratio | Resolution | Max Duration |
|----------|-------------|------------|--------------|
| TikTok | 9:16 (vertical) | 1080x1920 | 180s |
| Instagram Reel | 9:16 (vertical) | 1080x1920 | 90s |
| YouTube Shorts | 9:16 (vertical) | 1080x1920 | 60s |
| Instagram Post | 1:1 (square) | 1080x1080 | 60s |
| Facebook | 16:9 (landscape) | 1280x720 | 240s |
| YouTube | 16:9 (landscape) | 1920x1080 | 600s |
| Twitter/X | 16:9 (landscape) | 1280x720 | 140s |

### 12.2 Export Status Lifecycle

```
queued --> processing --> done
                     \-> error
```

---

## 13. Prompt Management System

An administrative prompt management interface exists with three sub-systems:

### 13.1 Prompt Templates
One template per video type containing a base prompt and negative prompt. Versioned, with active/inactive toggle.

### 13.2 Prompt Fragments
142 reusable prompt building blocks organized by category (scene, camera, lighting, speaker_style, etc.). Each fragment has a key, value, category, and optional video type restriction.

### 13.3 System Prompts
5 system prompts (one per video type) containing the LLM system prompt and user prompt template. Configurable model (default: gpt-4o-mini), temperature (default: 0.9), and max_tokens (default: 600).

---

## 14. Realtime Features

The application uses Supabase Realtime subscriptions (`useRealtimeStatus` hook) to watch for status changes on:
- `clips` table: Updates clip status in real time during generation
- `episodes` table: Tracks shot generation and stitching progress
- `compilations` table: Monitors stitching progress

A polling fallback (5-second interval) operates when items have processing statuses.

---

## 15. Design System

### 15.1 Color Palette

| Role | Color | Usage |
|------|-------|-------|
| Background | zinc-950 / zinc-900 | Page and card backgrounds |
| Primary Text | zinc-100 | Headings and primary content |
| Secondary Text | zinc-400 / zinc-500 | Labels and descriptions |
| Muted Text | zinc-600 | Timestamps and metadata |
| Primary Accent | amber-500 | CTAs, active states, branding |
| Subway | amber-400/500 | Subway interview type |
| Street | emerald-400/500 | Street interview type |
| Motivational | red-400 / rose-400 | Motivational type |
| Wisdom | amber-400/500 | Wisdom interview type |
| Studio | sky-400/500 | Studio interview type |
| Success | emerald-400 | Completed states |
| Error | red-400 / rose-400 | Error states |
| Warning | amber-400 | Pending/queued states |
| Processing | sky-400 | Running/generating states |

### 15.2 Component Patterns

- **Cards:** `rounded-2xl border border-zinc-800/60 bg-zinc-900/40`
- **Buttons (primary):** `bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold rounded-xl`
- **Status badges:** Pill-shaped with colored dot, border, and background tint
- **Toggle cards:** Enable/disable switch with accordion expand, single-open constraint
- **Skeleton loaders:** Matching card shapes with `animate-pulse`
- **Step indicators:** Numbered circles connected by lines, with amber active state

### 15.3 Typography

- Font: System default (Inter referenced in Remotion effects)
- Headings: `font-bold` / `font-semibold`, tracking-tight
- Body: `text-sm` / `text-xs`
- Monospace: Used for IDs and prompt fragment keys

### 15.4 Responsive Breakpoints

- Mobile: Single column layouts
- `sm:` (640px): 2-column grids
- `lg:` (1024px): 3-4 column grids, sidebar layouts
- `max-w-7xl` (dashboard), `max-w-6xl` (library/templates), `max-w-5xl` (create hub), `max-w-4xl` (clip detail/wizards), `max-w-3xl` (settings)
