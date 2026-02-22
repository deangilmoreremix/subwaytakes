/*
  # Seed Prompt Templates and Fragments

  Seeds the prompt management system with all existing hardcoded prompts from the codebase.

  1. Prompt Templates
    - One template per video type (5 total), containing the base prompt structure,
      negative prompts, system rules, visual anchors, and forbidden elements

  2. Prompt Fragments
    - Scene fragments (subway scenes, street scenes, studio setups, wisdom settings)
    - Camera style fragments
    - Lighting fragments
    - Speaker style fragments
    - Energy level fragments
    - Interview style fragments
    - Time of day fragments
    - Character fragments (interviewer types, positions, subject demographics, styles)
    - City visual cue fragments
    - Wisdom-specific fragments (tones, formats, demographics)

  3. System Prompts
    - One system prompt config per video type for OpenAI script generation
    - Includes the system prompt, user prompt template, model config, and topic contexts

  4. Important Notes
    - All seeded records have user_id = NULL (system-level defaults)
    - These serve as the baseline that can be overridden per-user
*/

-- ============================================================
-- PROMPT TEMPLATES (one per video type)
-- ============================================================

INSERT INTO prompt_templates (user_id, video_type, name, version, is_active, base_prompt, negative_prompt, system_rules, visual_anchors, forbidden_elements, metadata) VALUES

-- SUBWAY INTERVIEW
(NULL, 'subway_interview', 'SubwayTakes Default', 1, true,
E'INTERVIEWER IDENTITY (MANDATORY):\n- The interviewer MUST wear dark sunglasses at all times (signature brand element).\n- Sunglasses style: dark, rectangular or aviator, always worn indoors on the subway.\n- Clothing: casual blazer or jacket over a relaxed shirt, put-together but not formal.\n- Hair: natural/curly texture.\n- Energy: confident, warm, comedic timing, genuine curiosity.\n- The interviewer''s sunglasses are NEVER removed during filming.\n\nMICROPHONE RULE (MANDATORY):\n- The interviewer MUST hold a flat rectangular card (subway ticket, metro card, transit pass).\n- The card is used AS the microphone and is clearly visible in the frame.\n- The card is held in the interviewer''s hand and extended toward the subject.\n- NO traditional microphones, lavaliers, headsets, boom mics, or phones used as microphones.\n- The card should be plain, minimal, and realistic (no logos unless specified).\n- Camera framing must clearly show the card between interviewer and subject.\n\nVISUAL STYLE (MANDATORY):\n- Natural ambient subway fluorescent lighting only. No studio lights, no ring lights.\n- Warm color temperature with slight yellow cast from subway fluorescents.\n- NYC MTA subway car interior: blue plastic seats, silver handrails, subway route map on wall.\n- Documentary-style handheld framing: authentic, not staged, real commuters in background.\n- No heavy color grading, no filters, no green screen.\n- Real subway car environment with natural imperfections (movement, noise, other passengers).\n\nRealistic viral subway interview clip, SubwayTakes documentary style, {{duration}} seconds.\nVertical 9:16 format. Handheld camera, raw authentic feel.\n\nLocation: {{city_visuals}}\nScene: {{scene_setting}}\nInterview approach: {{interview_style}}\n\n{{character_description}}\n\nTopic: {{question_context}}\n{{energy_description}}\n\nVisual elements: Include subway ambience - train sounds, announcement echoes, commuters passing, platform activity.\n\nVisual Anchor (CRITICAL):\n- Close or medium shot clearly showing the interviewer''s hand holding a subway card.\n- The card is positioned where a microphone would normally be.\n- Subject speaks toward the card naturally.\n- Card remains visible for most of the clip.\n\nCamera Framing (CRITICAL):\n- Medium close-up or tight two-shot showing interviewer and subject.\n- Interviewer''s hand holding the subway card MUST be visible in frame.\n- Avoid extreme close-ups that hide the interviewer''s hand.\n- Hands must be visible in frame - the card must NOT be cropped out.\n\nCamera: Handheld documentary style, shallow depth of field, intimate framing, slight natural shake.\nLighting: Natural subway fluorescent lighting, warm tones, no studio lights.\nMood: Urban, raw, authentic, spontaneous, real city life, viral-worthy moment.\n\nNo text inside the video frame. Single continuous shot. Capture genuine human moment.\n\nFinal QA Check (CRITICAL):\n- If the card used as the microphone is not clearly visible, regenerate the scene.\n- Do not proceed unless the subway card is present and being used as the mic.',
'no distorted faces, no extra limbs, no unreadable text, no watermarks, no logos, no celebrity lookalikes, no text overlays in video, no handheld microphone, no lavalier mic, no boom mic, no headset mic, no visible audio equipment, no phone used as microphone, no traditional podcast microphone, no studio lighting, no ring light, no color filters, no green screen, no interviewer without sunglasses',
E'MICROPHONE RULE (MANDATORY):\n- The interviewer MUST hold a flat rectangular card (subway ticket, metro card, transit pass).\n- The card is used AS the microphone and is clearly visible in the frame.\n- The card is held in the interviewer''s hand and extended toward the subject.\n- NO traditional microphones, lavaliers, headsets, boom mics, or phones used as microphones.',
E'- Interviewer''s hand holding the subway card/ticket is visible and centered like a microphone.\n- The card stays in frame for most of the clip.\n- Use medium shot or tight two-shot; do NOT crop out hands.\n- Subject speaks naturally toward the card.\n- Hands visible when interviewer is interacting with subject.\n- Documentary framing: mid-shot to close-up.\n- Natural motion and authentic reactions.',
E'- No handheld microphones\n- No lavalier microphones\n- No boom microphones\n- No headset microphones\n- No phones used as microphones\n- No podcast mics',
'{"brand": "SubwayTakes", "signature_elements": ["dark_sunglasses", "card_mic", "subway_setting"]}'::jsonb),

-- STREET INTERVIEW
(NULL, 'street_interview', 'Street Interview Default', 1, true,
E'Realistic street interview clip, documentary style, {{duration}} seconds.\nVertical 9:16 format. Handheld camera, authentic feel.\n\nLocation: {{location_description}}\nTime: {{time_description}}\nInterview approach: {{interview_style}}\n\n{{character_description}}\n\nTopic: Candid interview moment about {{topic}}.\n{{energy_description}}\n\nCamera: Handheld mid-shot to close-up, shallow depth of field, slight natural shake.\nLighting: Natural available light appropriate for time of day.\nMood: authentic, spontaneous, real, candid, viral-worthy moment.\n\nNo text inside the video frame. Single continuous shot. Capture genuine human moment.',
'no distorted faces, no extra limbs, no unreadable text, no watermarks, no logos, no celebrity lookalikes, no text overlays in video',
'',
E'- Hands visible when interviewer is interacting with subject.\n- Documentary framing: mid-shot to close-up.\n- Natural motion and authentic reactions.',
'',
'{}'::jsonb),

-- MOTIVATIONAL
(NULL, 'motivational', 'Motivational Default', 1, true,
E'Vertical 9:16 motivational speaker video clip, {{duration}} seconds.\n\nSpeaker: {{speaker_style}}\nTopic: {{topic}} - delivering powerful message about this theme.\n\nSetting: {{setting}}\nCamera: {{camera_style}}\nLighting: {{lighting}}\n\nMood: determined, powerful, inspiring, relentless, viral-worthy intensity.\nThe speaker is mid-delivery of an impactful motivational speech moment.\n\nNo comedy, no parody, no text inside the video frame.\nSingle continuous shot. Capture the raw emotion and intensity.',
'no distorted faces, no extra limbs, no unreadable text, no watermarks, no logos, no celebrity lookalikes, no text overlays in video',
'', '', '',
'{}'::jsonb),

-- STUDIO INTERVIEW
(NULL, 'studio_interview', 'Studio Interview Default', 1, true,
E'Vertical 9:16 studio interview video, {{duration}} seconds, single continuous shot.\n\nSTUDIO ENVIRONMENT:\n{{studio_setup}}\n\nLIGHTING:\n{{studio_lighting}}\n\nPEOPLE:\n{{interviewer_description}}\n{{subject_description}}\n\nTOPIC: {{topic}}\n{{question_line}}\n\nSHOT COMPOSITION:\n- Start with a two-shot establishing the studio environment\n- Subtle camera movement: gentle push-in during key moments\n- Cut-away style: if single shot, slow drift between speakers\n- Both subjects visible, natural eye contact and gestures\n- Professional framing with headroom and look-space\n\nPERFORMANCE DIRECTION:\n- Natural conversation rhythm, not scripted-feeling\n- Genuine reactions: nodding, leaning in, thoughtful pauses\n- Hand gestures when making points\n- Real engagement between speakers\n- Host actively listens, doesn''t just wait to ask next question\n\nAUDIO ATMOSPHERE:\n- Clean studio audio quality\n- Subtle room tone (not dead silence)\n- No music during conversation\n- Natural speech cadence with breath sounds\n\nVISUAL QUALITY:\n- Shallow depth of field on speaker when close\n- Rich color grading appropriate to setup\n- No text overlays inside video frame\n- Professional broadcast quality',
'no distorted faces, no extra limbs, no unreadable text, no watermarks, no logos, no celebrity lookalikes, no text overlays in video',
'',
E'- Hands visible when interviewer is interacting with subject.\n- Documentary framing: mid-shot to close-up.\n- Natural motion and authentic reactions.',
'',
'{}'::jsonb),

-- WISDOM INTERVIEW
(NULL, 'wisdom_interview', 'Wisdom Interview Default', 1, true,
E'Vertical 9:16 short-form interview video, {{duration}} seconds.\nTarget audience: 55+ viewers, content that respects their intelligence and experience.\n\nYou are creating a short-form interview video (9:16) designed for audiences 55+.\n\nCORE IDENTITY:\n- The interviewee(s) are 55-75 years old, gray hair, calm confidence.\n- The advice is grounded, respectful, and practical.\n- The voice is wise and conversational, not trendy or sarcastic.\n- No stereotypes. No mocking age. No "boomer" jokes.\n- Respectful disagreement only - no shouting, no aggression.\n\nVOICE & WRITING RULES:\n- No slang overload\n- Short sentences, clear and direct\n- Phrases like: "I''ve learned..." "Here''s what I wish I knew..." "What matters is..."\n- Optimistic realism, not toxic positivity\n- Measured delivery with thoughtful pauses implied\n\nVISUAL CASTING RULES:\n- Interviewees: 55-75 years old, gray or silver hair visible\n- Natural faces, confident posture, no filter-looks\n- Wardrobe: smart casual, simple, timeless\n- Vibe: calm, grounded, real-world experience\n\nFORMAT: {{wisdom_format}}\nTONE: {{wisdom_tone}}\nSETTING: {{wisdom_setting}}\nSUBJECT: {{wisdom_demographic}}\n\nTOPIC: {{topic}}\n\nSTRUCTURE:\n1) Hook - Scroll-stopping question or statement\n2) Main take - Subject core insight or opinion\n3) Supporting content - Brief story, example, or elaboration\n4) Closing - Thoughtful ending with space for caption CTA\n\nVISUAL STYLE:\n- Natural lighting appropriate to setting\n- Warm color grading, not cool or trendy\n- Shallow depth of field to focus on subject\n- Steady camera, no fast cuts\n- Professional but authentic documentary feel\n\nNo text overlays inside the video frame. Single continuous shot. Capture genuine human wisdom.',
'no distorted faces, no extra limbs, no unreadable text, no watermarks, no logos, no celebrity lookalikes, no text overlays in video',
'',
'',
'',
'{"target_audience": "55+", "core_values": ["respect", "authenticity", "wisdom"]}'::jsonb);

-- ============================================================
-- PROMPT FRAGMENTS - Scene types
-- ============================================================

INSERT INTO prompt_fragments (user_id, category, key, video_type, content) VALUES
-- Subway scenes
(NULL, 'scene', 'platform_waiting', 'subway_interview', 'Subject standing on subway platform waiting for train, train arriving in background, platform edge visible'),
(NULL, 'scene', 'inside_train', 'subway_interview', 'Subject seated or standing inside moving subway car, windows showing tunnel motion, other passengers visible'),
(NULL, 'scene', 'train_arriving', 'subway_interview', 'Dramatic moment as subway doors slide open, subject visible through doors, passengers stepping on/off'),
(NULL, 'scene', 'rush_hour', 'subway_interview', 'Crowded platform during rush hour, dense pack of commuters, chaotic energy, movement all around'),
(NULL, 'scene', 'late_night', 'subway_interview', 'Nearly empty subway platform at night, moody fluorescent lighting, few scattered passengers, quiet atmosphere'),
(NULL, 'scene', 'walking_through', 'subway_interview', 'Subject walking through subway station corridor, turnstiles or stairs visible, other commuters passing'),

-- Street scenes
(NULL, 'scene', 'busy_sidewalk', 'street_interview', 'Busy city sidewalk, high pedestrian traffic, urban energy, people walking past in background'),
(NULL, 'scene', 'coffee_shop_exterior', 'street_interview', 'Coffee shop patio exterior, cafe tables visible, relaxed urban environment, neighborhood vibe'),
(NULL, 'scene', 'park_bench', 'street_interview', 'City park setting, green trees and grass, park bench visible, nature within urban environment'),
(NULL, 'scene', 'crosswalk', 'street_interview', 'Street intersection with crosswalk, traffic movement, urban crossing, city pulse'),
(NULL, 'scene', 'shopping_district', 'street_interview', 'Upscale shopping district, storefronts and window displays, affluent urban area'),
(NULL, 'scene', 'quiet_neighborhood', 'street_interview', 'Quiet residential neighborhood, brownstones or houses visible, intimate community feel'),

-- Studio setups
(NULL, 'scene', 'podcast_desk', 'studio_interview', 'Professional podcast studio with dual microphones on boom arms, acoustic panels on walls, large desk with laptops and notes visible. Host and guest sit across from each other, intimate conversation distance. Warm amber desk lamps, soundproof room feel.'),
(NULL, 'scene', 'living_room', 'studio_interview', E'Upscale living room set with mid-century modern furniture, tasteful bookshelf backdrop, plants and warm lighting. Two comfortable armchairs angled toward each other. Feels personal and relaxed, like visiting someone''s home.'),
(NULL, 'scene', 'minimalist_stage', 'studio_interview', 'Clean minimalist studio stage with solid dark backdrop, single spotlight, no distractions. Subject centered in frame. Modern, clean, TED-talk energy. Focus entirely on the speaker.'),
(NULL, 'scene', 'late_night', 'studio_interview', 'Late-night talk show set with city skyline backdrop, curved desk, guest chair. Band area suggested in background. Vibrant, energetic, entertainment-forward atmosphere. Rich jewel-tone lighting.'),
(NULL, 'scene', 'roundtable', 'studio_interview', 'Roundtable discussion setup with 3-4 seats around a curved table. Multiple camera angles implied. News/analysis feel with neutral grey-blue backdrop and professional lighting. Panel discussion energy.'),
(NULL, 'scene', 'fireside', 'studio_interview', 'Intimate fireside chat setup. Two leather chairs beside a warm fireplace, low ambient lighting, bookshelves in background. Cozy, private, confessional atmosphere. Think Charlie Rose or masterclass vibe.'),
(NULL, 'scene', 'news_desk', 'studio_interview', 'Professional news studio with anchor desk, multiple screens in background showing graphics. Clean, authoritative, credible atmosphere. Blue-white color scheme, crisp professional lighting.'),
(NULL, 'scene', 'creative_loft', 'studio_interview', 'Industrial creative loft studio with exposed brick, Edison bulbs, vinyl records and art on walls. Two stools at a high table with whiskey glasses. Creative, authentic, podcast-meets-art-gallery vibe.'),

-- Wisdom settings
(NULL, 'scene', 'park_bench', 'wisdom_interview', 'City park setting, green trees visible, park bench where locals gather. Relaxed outdoor atmosphere, natural daylight, peaceful urban oasis.'),
(NULL, 'scene', 'coffee_shop', 'wisdom_interview', 'Cozy coffee shop interior, warm lighting, comfortable seating. Ambient cafe sounds, familiar neighborhood spot. Intimate conversation vibe.'),
(NULL, 'scene', 'living_room', 'wisdom_interview', 'Comfortable home living room, soft furniture, personal touches visible. Family photos, bookshelves, lived-in warmth. Intimate, trusted space.'),
(NULL, 'scene', 'library', 'wisdom_interview', 'Quiet public library, tall bookshelves, soft ambient sounds. Scholarly atmosphere, thoughtful setting. Wisdom of ages surrounding the conversation.'),
(NULL, 'scene', 'main_street', 'wisdom_interview', 'Charming main street or town square, local businesses visible. Community atmosphere, familiar faces passing. Small-town America feel.'),
(NULL, 'scene', 'subway_platform', 'wisdom_interview', 'Calm subway platform, not rush hour. Quiet moment for reflection. Urban transit setting, everyday wisdom in passing.'),
(NULL, 'scene', 'community_center', 'wisdom_interview', 'Community center or senior center, activity room or common area. Group setting, shared wisdom. Warm, social atmosphere.'),

-- Motivational settings
(NULL, 'scene', 'gym', 'motivational', 'Commercial gym setting, weight racks visible, rubber floor, industrial lighting, mirrors in background, iron and sweat atmosphere'),
(NULL, 'scene', 'stage', 'motivational', 'Conference stage with dramatic spotlights, audience silhouettes visible, professional sound setup, LED screens behind, keynote speaker environment'),
(NULL, 'scene', 'outdoor', 'motivational', 'Outdoor location with epic natural backdrop, mountains or ocean visible, wind in hair, golden sunlight, adventure lifestyle setting'),
(NULL, 'scene', 'studio', 'motivational', 'Clean podcast studio setup, professional microphones visible, acoustic panels, ring lights, content creator aesthetic'),
(NULL, 'scene', 'urban_rooftop', 'motivational', 'Urban rooftop at sunset, city skyline in background, concrete and glass towers, success lifestyle environment'),
(NULL, 'scene', 'office', 'motivational', 'Executive corner office, floor-to-ceiling windows, city views, leather furniture, success and achievement environment'),
(NULL, 'scene', 'locker_room', 'motivational', 'Sports team locker room, metal lockers, wooden benches, pre-game intensity, team motivation environment');

-- ============================================================
-- PROMPT FRAGMENTS - Camera styles
-- ============================================================

INSERT INTO prompt_fragments (user_id, category, key, video_type, content) VALUES
(NULL, 'camera', 'dramatic_push', NULL, 'Camera slowly pushes in toward subject, building intensity, narrowing focus, cinematic zoom effect'),
(NULL, 'camera', 'slow_orbit', NULL, 'Camera slowly orbits around subject, epic 360 movement, dynamic perspective shift, reveals environment'),
(NULL, 'camera', 'tight_closeup', NULL, 'Extreme close-up on face, eyes and expression fill frame, intimate and intense, emotional detail visible'),
(NULL, 'camera', 'wide_epic', NULL, 'Wide establishing shot showing subject in grand environment, scale and context, inspirational framing'),
(NULL, 'camera', 'handheld_raw', NULL, 'Handheld camera with slight natural shake, documentary authenticity, raw unpolished feel, in-the-moment');

-- ============================================================
-- PROMPT FRAGMENTS - Lighting
-- ============================================================

INSERT INTO prompt_fragments (user_id, category, key, video_type, content) VALUES
(NULL, 'lighting', 'golden_hour', NULL, 'Golden hour warm lighting, sunset tones, cinematic amber glow, soft shadows, magical hour aesthetic'),
(NULL, 'lighting', 'dramatic_shadows', NULL, 'High contrast dramatic lighting, deep shadows on face, moody atmosphere, rembrandt lighting style'),
(NULL, 'lighting', 'high_contrast', NULL, 'Bold high contrast lighting, punchy blacks and whites, graphic quality, strong visual impact'),
(NULL, 'lighting', 'studio_clean', NULL, 'Professional studio lighting, even soft light, flattering on face, broadcast quality, clean aesthetic'),
(NULL, 'lighting', 'moody_backlit', NULL, 'Backlit silhouette edges, atmospheric halo effect, mysterious mood, rim lighting on subject'),
-- Studio-specific lighting
(NULL, 'lighting', 'three_point', 'studio_interview', 'Classic three-point lighting setup: key light at 45 degrees, fill light softer on opposite side, back/rim light separating subject from background. Professional, flattering, industry-standard look.'),
(NULL, 'lighting', 'dramatic_key', 'studio_interview', 'Single dramatic key light creating strong shadows on one side of the face. Moody, cinematic, editorial look. Background darker. Creates visual tension and authority.'),
(NULL, 'lighting', 'soft_diffused', 'studio_interview', 'Soft diffused lighting from large softboxes or ring lights. Even, flattering illumination with minimal shadows. Beauty/fashion quality. Clean, modern, approachable look.'),
(NULL, 'lighting', 'colored_accent', 'studio_interview', 'Neutral key light with colored accent lights in the background (warm amber, cool blue, or brand colors). Adds depth and visual interest. Contemporary, branded, social-media-forward aesthetic.'),
(NULL, 'lighting', 'natural_window', 'studio_interview', 'Natural window light from one side creating soft, authentic illumination. Blinds or curtains filtering sunlight. Organic, documentary feel. Real, unproduced, trustworthy vibe.'),
(NULL, 'lighting', 'cinematic', 'studio_interview', 'Cinematic lighting with motivated practical sources (desk lamp, window, screen glow). Shallow depth of field implied. Film-quality look with intentional color palette and mood.');

-- ============================================================
-- PROMPT FRAGMENTS - Speaker styles (motivational)
-- ============================================================

INSERT INTO prompt_fragments (user_id, category, key, video_type, content) VALUES
(NULL, 'speaker_style', 'intense_coach', 'motivational', 'Intense motivational speaker with drill sergeant energy, leaning forward, commanding presence, finger pointing, veins showing, passionate delivery'),
(NULL, 'speaker_style', 'calm_mentor', 'motivational', 'Wise mentor figure speaking calmly, measured delivery, thoughtful pauses, warm eye contact, open body language, reassuring presence'),
(NULL, 'speaker_style', 'hype_man', 'motivational', 'High energy hype speaker, animated gestures, jumping movements, crowd-pumping enthusiasm, infectious energy, rapid delivery'),
(NULL, 'speaker_style', 'wise_elder', 'motivational', 'Experienced elder figure, sage-like delivery, weathered wisdom, deliberate speech, knowing looks, earned authority'),
(NULL, 'speaker_style', 'corporate_exec', 'motivational', 'Polished business executive, tailored suit, confident posture, boardroom presence, strategic gestures, professional gravitas'),
(NULL, 'speaker_style', 'athlete', 'motivational', 'Athletic speaker, physical intensity, competitor mindset, powerful stance, disciplined energy, sports imagery');

-- ============================================================
-- PROMPT FRAGMENTS - Interview styles (shared)
-- ============================================================

INSERT INTO prompt_fragments (user_id, category, key, video_type, content) VALUES
(NULL, 'interview_style', 'quick_fire', NULL, 'Quick fire interview pacing, rapid questions, punchy responses, energetic back and forth'),
(NULL, 'interview_style', 'deep_conversation', NULL, 'Deep conversation style, thoughtful pauses, philosophical exchange, meaningful dialogue'),
(NULL, 'interview_style', 'man_on_street', NULL, 'Classic man on the street approach, casual stop, spontaneous answers, vox pop style'),
(NULL, 'interview_style', 'ambush_style', NULL, 'Ambush interview style, caught off guard reactions, surprised expressions, raw unfiltered response'),
(NULL, 'interview_style', 'friendly_chat', NULL, 'Friendly conversation approach, warm rapport, comfortable exchange, genuine connection'),
(NULL, 'interview_style', 'hot_take', NULL, 'Hot take delivery, bold confident opinion, controversial stance, unwavering conviction, mic drop energy'),
(NULL, 'interview_style', 'confessional', NULL, 'Confessional intimate moment, vulnerable sharing, personal revelation, emotional authenticity, close whispered tone'),
(NULL, 'interview_style', 'debate_challenge', NULL, 'Debate challenge format, defending position, push-back energy, intellectual sparring, point-counterpoint dynamic'),
(NULL, 'interview_style', 'reaction_test', NULL, 'Reaction test scenario, reading prompt or statement, genuine surprise or shock, unfiltered first impression, authentic response moment'),
(NULL, 'interview_style', 'serious_probe', NULL, 'Serious investigative probe, pressing questions, searching for truth, journalist intensity, accountability interview style'),
(NULL, 'interview_style', 'storytelling', NULL, 'Storytelling narrative mode, recounting personal experience, expressive hand gestures, vivid memory recall, captivating anecdote delivery'),
(NULL, 'interview_style', 'unpopular_opinion', NULL, 'Unpopular opinion format, defending controversial stance, expecting pushback, bold declaration, conviction despite opposition'),
(NULL, 'interview_style', 'exposed_callout', NULL, 'Expose industry secrets format, revealing hidden truths, insider knowledge, whistleblowing energy, breaking fourth wall'),
(NULL, 'interview_style', 'red_flag_detector', NULL, 'Red flag detection mode, identifying warning signs, skepticism, cautionary tone, teaching moment, pattern recognition'),
(NULL, 'interview_style', 'hot_take_react', NULL, 'Hot take reaction style, responding to trending topics, real-time commentary, immediate opinion, trending topic energy'),
(NULL, 'interview_style', 'confessions', NULL, 'Confession format, personal story sharing, intimate revelation, emotional vulnerability, therapeutic sharing, cathartic moment'),
(NULL, 'interview_style', 'before_after_story', NULL, 'Before and after transformation journey, dramatic change narrative, personal growth story, dramatic contrast, inspiring transformation'),
(NULL, 'interview_style', 'finish_sentence', NULL, 'Finish the sentence prompt, completing thought, collaborative storytelling, creative completion, interactive format'),
(NULL, 'interview_style', 'one_piece_advice', NULL, 'One piece of advice delivery, single powerful tip, memorable takeaway, wisdom bomb, impactful guidance moment'),
(NULL, 'interview_style', 'would_you_rather', NULL, 'Would you rather format, choosing between options, preference reveal, debate energy, fun polarization'),
(NULL, 'interview_style', 'street_quiz', NULL, 'Street quiz format, trick questions, knowledge test, surprising answers, quiz show energy, trivia challenge');

-- ============================================================
-- PROMPT FRAGMENTS - Energy levels (shared)
-- ============================================================

INSERT INTO prompt_fragments (user_id, category, key, video_type, content) VALUES
(NULL, 'energy', 'calm', NULL, 'Subject gives calm, thoughtful response, relaxed body language, contemplative expression, measured speaking pace'),
(NULL, 'energy', 'conversational', NULL, 'Subject responds naturally and conversationally, friendly demeanor, easy engagement, authentic dialogue feel'),
(NULL, 'energy', 'high_energy', NULL, 'Subject responds with animated energy, expressive gestures, enthusiastic reactions, dynamic presence'),
(NULL, 'energy', 'chaotic', NULL, 'Subject gives wild, unexpected reaction, surprised expressions, dramatic gestures, unpredictable energy');

-- ============================================================
-- PROMPT FRAGMENTS - Time of day (shared)
-- ============================================================

INSERT INTO prompt_fragments (user_id, category, key, video_type, content) VALUES
(NULL, 'time_of_day', 'early_morning', NULL, '5AM quiet platforms, sleepy commuters, early risers, peaceful dawn atmosphere'),
(NULL, 'time_of_day', 'morning_rush', NULL, '7-9AM packed trains, coffee-fueled energy, hurried commuters, peak morning chaos'),
(NULL, 'time_of_day', 'midday', NULL, 'Midday bright sunlight, harsh shadows, lunch crowd activity, peak daylight'),
(NULL, 'time_of_day', 'evening_rush', NULL, '5-7PM tired commuters heading home, social energy, end of workday vibe'),
(NULL, 'time_of_day', 'late_night', NULL, '11PM+ nearly empty platforms, mysterious atmosphere, night owls, quiet solitude'),
(NULL, 'time_of_day', 'weekend', NULL, 'Weekend relaxed vibe, tourists, different energy, non-commuter crowd'),
(NULL, 'time_of_day', 'golden_hour', NULL, 'Golden hour sunset glow, warm light, magic hour beauty, cinematic tones'),
(NULL, 'time_of_day', 'dusk', NULL, 'Dusk blue hour, city lights beginning, transitional light, evening atmosphere'),
(NULL, 'time_of_day', 'night', NULL, 'Nighttime urban setting, street lights illumination, neon signs, city nightlife energy');

-- ============================================================
-- PROMPT FRAGMENTS - City visual cues (subway)
-- ============================================================

INSERT INTO prompt_fragments (user_id, category, key, video_type, content) VALUES
(NULL, 'city', 'nyc', 'subway_interview', E'New York City MTA subway aesthetic, white tile walls with colored trim, yellow platform edge safety line, classic NYC station signage, green globe lights at entrance.\n\nINTERVIEWER CARD MIC: Hold MetroCard - rectangular white plastic card with blue/orange stripe, tapped against fare reader. Card is visible in hand showing the stripe. Casual NYC commuter gesture.'),
(NULL, 'city', 'london', 'subway_interview', E'London Underground aesthetic, rounded tunnel walls, Mind the Gap platform warning, roundel logo visible, deep escalators, brown and cream tiles.\n\nINTERVIEWER CARD MIC: Hold Oyster card - distinctive brown rounded rectangular card with contactless symbol, shown in palm ready to tap. Iconic London Underground gesture.'),
(NULL, 'city', 'tokyo', 'subway_interview', E'Tokyo Metro aesthetic, ultra-clean platforms, organized queuing lines on floor, digital screens, bright white lighting, orderly commuters.\n\nINTERVIEWER CARD MIC: Hold Suica/ICOCA/Pasmo - thin RFID card, quick tap motion between thumb and finger. Card shows cute character design.'),
(NULL, 'city', 'paris', 'subway_interview', E'Paris Metro aesthetic, Art Nouveau entrance style, dark green railings, vintage tilework, Metropolitain signage, narrow platforms.\n\nINTERVIEWER CARD MIC: Hold Navigo card - rectangular card with weekly/monthly pass display window, displayed to show validation strip. Classic French transit card handling.'),
(NULL, 'city', 'generic', 'subway_interview', 'Generic modern urban subway station, concrete pillars, fluorescent lighting, standard transit infrastructure.\n\nINTERVIEWER CARD MIC: Hold generic transit card - plain rectangular card without prominent branding, used as microphone.');

-- ============================================================
-- PROMPT FRAGMENTS - Character types (shared)
-- ============================================================

INSERT INTO prompt_fragments (user_id, category, key, video_type, content) VALUES
(NULL, 'interviewer_type', 'podcaster', NULL, 'Professional host vibe, confident media presence, practiced interviewing style (no visible traditional mic hardware).'),
(NULL, 'interviewer_type', 'documentary_journalist', NULL, 'Serious documentary interviewer demeanor, authentic street journalism energy (no visible traditional mic hardware).'),
(NULL, 'interviewer_type', 'casual_creator', NULL, 'Casual creator vibe, approachable, authentic energy, natural conversation flow (no visible traditional mic hardware).'),
(NULL, 'interviewer_type', 'news_reporter', NULL, 'Broadcast reporter vibe and delivery, confident and professional (no visible traditional mic hardware).'),
(NULL, 'interviewer_type', 'hidden_voice_only', NULL, 'Interviewer off-camera; only hand is visible extending the subway card/ticket toward subject.'),

(NULL, 'subject_demographic', 'any', NULL, 'Random everyday person, authentic street casting, diverse representation'),
(NULL, 'subject_demographic', 'young_professional', NULL, 'Young professional in their late 20s to mid 30s, career-focused appearance, confident posture'),
(NULL, 'subject_demographic', 'college_student', NULL, 'College-age student, youthful energy, casual student style, early 20s appearance'),
(NULL, 'subject_demographic', 'middle_aged', NULL, 'Middle-aged person, experienced presence, mature demeanor, 40s to 50s appearance'),
(NULL, 'subject_demographic', 'senior', NULL, 'Senior citizen, wise appearance, life experience visible, 60+ years old with gray or silver hair'),
(NULL, 'subject_demographic', 'business_exec', NULL, 'Business executive type, power presence, leadership demeanor, successful appearance'),
(NULL, 'subject_demographic', 'creative_type', NULL, 'Creative professional, artistic appearance, unique personal style, designer or artist vibe'),
(NULL, 'subject_demographic', 'fitness_enthusiast', NULL, 'Fitness-focused person, athletic build, healthy appearance, gym-goer energy');

-- ============================================================
-- PROMPT FRAGMENTS - Wisdom-specific (tones, formats, demographics)
-- ============================================================

INSERT INTO prompt_fragments (user_id, category, key, video_type, content) VALUES
(NULL, 'wisdom_tone', 'gentle', 'wisdom_interview', 'Warm, patient delivery with soft tone. Subject speaks like speaking to a dear friend. Gentle smile, kind eyes, unhurried pacing. Calm, supportive energy.'),
(NULL, 'wisdom_tone', 'direct', 'wisdom_interview', 'No-nonsense, straightforward advice. Matter-of-fact delivery. Clear, honest opinions without being harsh. Confident, authoritative but not aggressive.'),
(NULL, 'wisdom_tone', 'funny', 'wisdom_interview', 'Dry wit, self-deprecating humor, clever observations. Light-hearted moments without being silly. Witty, charming, makes you smile not laugh out loud.'),
(NULL, 'wisdom_tone', 'heartfelt', 'wisdom_interview', 'Emotionally genuine, vulnerable moments. Touching stories, sincere appreciation. Warmth in voice, genuine connection. Moving without being maudlin.'),

(NULL, 'wisdom_format', 'motivation', 'wisdom_interview', 'Uplifting interview format. Subject shares wisdom to inspire. Warm lighting, supportive atmosphere. Focus on hope, possibility, encouragement.'),
(NULL, 'wisdom_format', 'street_conversation', 'wisdom_interview', 'Documentary-style street interview. Casual setting, natural light. Curious, conversational exchange. Real-world wisdom in everyday settings.'),
(NULL, 'wisdom_format', 'subway_take', 'wisdom_interview', 'Debate/discussion format but respectful. Interviewer agrees or gently challenges. Short back-and-forth. No shouting, just thoughtful exchange.'),

(NULL, 'wisdom_demographic', 'retirees', 'wisdom_interview', 'Active retiree, clearly enjoying post-work life. Traveling, hobbies, grandchildren, community involvement. Vital and engaged, not slowing down.'),
(NULL, 'wisdom_demographic', 'grandparents', 'wisdom_interview', 'Proud grandparent sharing family wisdom. Warm, loving, occasionally teasing about grandchildren. Generational connection.'),
(NULL, 'wisdom_demographic', 'late_career', 'wisdom_interview', 'Still working or recently retired professional. Career wisdom, professional advice. Experienced, respected, knowledgeable.'),
(NULL, 'wisdom_demographic', 'caregivers', 'wisdom_interview', 'Someone with caregiving experience (parents, spouse, grandchildren). Compassionate, patient, wise about sacrifice and love.'),
(NULL, 'wisdom_demographic', 'reinventors', 'wisdom_interview', 'Someone who started over later in life. New career, new city, new chapter. Courageous, inspiring, relatable struggles.'),
(NULL, 'wisdom_demographic', 'mentors', 'wisdom_interview', 'Natural mentor figure, always helping others. Guiding energy, eager to share lessons learned. Sage-like but accessible.');

-- ============================================================
-- SYSTEM PROMPTS (for OpenAI script generation)
-- ============================================================

INSERT INTO system_prompts (user_id, video_type, name, version, is_active, system_prompt, user_prompt_template, model, temperature, max_tokens, metadata) VALUES

(NULL, 'subway_interview', 'SubwayTakes Script Generator', 1, true,
E'You are an elite script writer for viral subway interview shows filmed on the NYC subway. Your content has generated millions of views across TikTok, YouTube Shorts, and Instagram Reels.\n\nGenerate scripts that are:\n- QUICK-PACED: Every second counts. Front-load entertainment value.\n- CONTROVERSIAL-RIGHT: Take genuine stances that spark debate and discussion.\n- RELATABLE: Universal experiences that make viewers say "same!".\n- EMOTIONAL: Trigger genuine reactions (shock, laughter, nodding, agreement).\n- OPTIMIZED: Perfect for vertical video format (9:16) with natural pauses for editing.\n\nSTRUCTURE:\n1. HOOK (0-3 sec): Direct, provocative question that stops scrolling\n2. ANSWER 1 (5-10 sec): Unexpected perspective or surprising confession\n3. FOLLOW-UP (2-3 sec): Dig deeper or challenge the take\n4. ANSWER 2 (5-8 sec): The money shot - most entertaining part\n5. REACTION (2-3 sec): Interviewer validates or reacts genuinely\n6. TAGLINE (2-3 sec): Memorable closer that makes rewatching worthwhile\n\nTONE: Authentic NYC energy, unscripted feel, Gen-Z/millennial crossover appeal.\nSETTING: NYC subway car, interviewer uses a subway card as a microphone.',
E'Generate a viral script for the topic: "{{topic}}" (related to: {{topic_context}}).{{custom_question}}\n\nINSTRUCTIONS:\n- Make it feel like a REAL conversation, not scripted\n- Guest/subject should have a unique perspective - NOT generic responses\n- Each answer should make viewers feel something\n- Include natural pauses and reactions for video editing\n- End with a memorable tagline that gets shared\n\nReturn ONLY valid JSON in this exact format:\n{\n  "hook_question": "the opening question or statement",\n  "guest_answer": "the guest/subject''s initial response",\n  "follow_up_question": "the interviewer''s follow-up or next beat",\n  "follow_up_answer": "the guest/subject''s second response",\n  "reaction_line": "the interviewer''s reaction or emotional beat",\n  "close_punchline": "the memorable closing line"\n}',
'gpt-4o-mini', 0.9, 600,
'{"topic_contexts": {"money": "finances, wealth, spending habits, financial decisions", "dating": "relationships, dating apps, love life, romantic experiences", "hottakes": "controversial opinions, unpopular beliefs, spicy takes", "personal": "personal life, habits, secrets, guilty pleasures", "career": "work life, jobs, professional experiences, workplace culture", "philosophy": "life meaning, deep thoughts, existential questions", "nyc": "New York City life, subway stories, city experiences", "fitness": "gym culture, workouts, health habits", "tech": "technology, social media, AI, gadgets", "socialmedia": "online presence, influencers, screen time", "family": "parents, siblings, family dynamics", "friendship": "friends, social circles, relationships", "hustle": "side hustles, entrepreneurship, making money", "mentalhealth": "mental wellness, therapy, self-care", "generational": "gen z, millennials, boomers, generational differences", "food": "eating habits, favorite foods, cooking", "music": "music taste, concerts, favorite artists", "sports": "athletics, teams, sports culture", "travel": "traveling, destinations, adventures"}}'::jsonb),

(NULL, 'street_interview', 'Street Interview Script Generator', 1, true,
E'You are an elite script writer for viral street interview content. You create compelling man-on-the-street interviews filmed in urban environments.\n\nGenerate scripts that are:\n- AUTHENTIC: Real conversations with everyday people\n- ENGAGING: Questions that provoke genuine, unscripted-feeling answers\n- SHAREABLE: Content that makes viewers want to share and comment\n- FAST-PACED: Quick exchanges that hold attention\n\nSTRUCTURE:\n1. HOOK (0-3 sec): Bold question or provocative statement\n2. ANSWER 1 (5-10 sec): Subject''s immediate reaction and perspective\n3. FOLLOW-UP (2-3 sec): Dig deeper or pivot to related angle\n4. ANSWER 2 (5-8 sec): The reveal, twist, or emotional peak\n5. REACTION (2-3 sec): Interviewer''s genuine response\n6. TAGLINE (2-3 sec): Memorable punchline or takeaway\n\nTONE: Casual, energetic, authentic street vibes.\nSETTING: Urban street, sidewalk, or public space.',
E'Generate a viral script for the topic: "{{topic}}" (related to: {{topic_context}}).{{custom_question}}\n\nINSTRUCTIONS:\n- Make it feel like a REAL conversation, not scripted\n- Guest/subject should have a unique perspective - NOT generic responses\n- Each answer should make viewers feel something\n- Include natural pauses and reactions for video editing\n- End with a memorable tagline that gets shared\n\nReturn ONLY valid JSON in this exact format:\n{\n  "hook_question": "the opening question or statement",\n  "guest_answer": "the guest/subject''s initial response",\n  "follow_up_question": "the interviewer''s follow-up or next beat",\n  "follow_up_answer": "the guest/subject''s second response",\n  "reaction_line": "the interviewer''s reaction or emotional beat",\n  "close_punchline": "the memorable closing line"\n}',
'gpt-4o-mini', 0.9, 600,
'{"topic_contexts": {"money": "finances, wealth, spending habits, financial decisions", "dating": "relationships, dating apps, love life, romantic experiences", "hottakes": "controversial opinions, unpopular beliefs, spicy takes", "personal": "personal life, habits, secrets, guilty pleasures", "career": "work life, jobs, professional experiences, workplace culture"}}'::jsonb),

(NULL, 'motivational', 'Motivational Script Generator', 1, true,
E'You are an elite script writer for motivational speaking content. You create powerful, inspiring monologues and interview clips.\n\nGenerate scripts that are:\n- INSPIRING: Words that move people to action\n- EMOTIONAL: Build from personal struggle to triumph\n- QUOTABLE: Lines that get screenshotted and shared\n- AUTHENTIC: Real experiences, not generic platitudes\n\nSTRUCTURE:\n1. HOOK (0-3 sec): Powerful opening statement that grabs attention\n2. ANSWER 1 (5-10 sec): The core message or personal revelation\n3. FOLLOW-UP (2-3 sec): The challenge or adversity faced\n4. ANSWER 2 (5-8 sec): The breakthrough moment or key insight\n5. REACTION (2-3 sec): The emotional peak or audience connection\n6. TAGLINE (2-3 sec): The memorable call-to-action or life lesson\n\nTONE: Intense, passionate, genuine. High energy that builds throughout.\nSETTING: Stage, gym, outdoor, or motivational environment.',
E'Generate a viral script for the topic: "{{topic}}" (related to: {{topic_context}}).{{custom_question}}\n\nMOTIVATIONAL-SPECIFIC:\n- Build emotional intensity throughout\n- Personal struggle to triumph arc\n- Lines that people want to screenshot\n- The close should be a powerful call to action\n\nReturn ONLY valid JSON in this exact format:\n{\n  "hook_question": "the opening question or statement",\n  "guest_answer": "the guest/subject''s initial response",\n  "follow_up_question": "the interviewer''s follow-up or next beat",\n  "follow_up_answer": "the guest/subject''s second response",\n  "reaction_line": "the interviewer''s reaction or emotional beat",\n  "close_punchline": "the memorable closing line"\n}',
'gpt-4o-mini', 0.9, 600,
'{}'::jsonb),

(NULL, 'studio_interview', 'Studio Interview Script Generator', 1, true,
E'You are an elite script writer for professional studio interviews. You create compelling, deep-dive conversations in professional studio settings.\n\nGenerate scripts that are:\n- INSIGHTFUL: Questions that reveal depth and expertise\n- CONVERSATIONAL: Natural flow between host and guest\n- THOUGHT-PROVOKING: Ideas that challenge conventional thinking\n- PROFESSIONAL: Polished but not stiff, smart but accessible\n\nSTRUCTURE:\n1. HOOK (0-3 sec): Intriguing opening question or bold statement\n2. ANSWER 1 (5-10 sec): Guest shares unique perspective or expertise\n3. FOLLOW-UP (2-3 sec): Host digs deeper with sharp follow-up\n4. ANSWER 2 (5-8 sec): The insight that makes viewers lean in\n5. REACTION (2-3 sec): Host acknowledges or reframes the point\n6. TAGLINE (2-3 sec): Memorable closing thought or call-back\n\nTONE: Professional but warm, intellectual but accessible. Think Joe Rogan meets Charlie Rose.\nSETTING: Professional studio environment.',
E'Generate a viral script for the topic: "{{topic}}" (related to: {{topic_context}}).{{custom_question}}\n\nSTUDIO-SPECIFIC:\n- Professional but engaging conversation flow\n- Host and guest have natural chemistry\n- Questions that reveal depth, not surface-level\n- The insight should feel like a genuine "aha" moment\n\nReturn ONLY valid JSON in this exact format:\n{\n  "hook_question": "the opening question or statement",\n  "guest_answer": "the guest/subject''s initial response",\n  "follow_up_question": "the interviewer''s follow-up or next beat",\n  "follow_up_answer": "the guest/subject''s second response",\n  "reaction_line": "the interviewer''s reaction or emotional beat",\n  "close_punchline": "the memorable closing line"\n}',
'gpt-4o-mini', 0.9, 600,
'{}'::jsonb),

(NULL, 'wisdom_interview', 'Wisdom Interview Script Generator', 1, true,
E'You are a script writer specializing in wisdom and life experience content for audiences 55+. Your content resonates with older adults and younger viewers who appreciate genuine wisdom.\n\nCORE RULES:\n- Interviewees are 55-75 years old with gray/silver hair, calm confidence\n- Advice is grounded, respectful, and practical\n- Voice is wise and conversational, not trendy or sarcastic\n- No age stereotypes, no mocking, no "boomer" jokes\n- Short sentences, clear and direct\n- Phrases like: "I''ve learned..." "Here''s what I wish I knew..." "What matters is..."\n- Optimistic realism, not toxic positivity\n\nSTRUCTURE:\n1. HOOK (0-3 sec): Thought-provoking question about life experience\n2. ANSWER 1 (5-10 sec): Subject shares core wisdom or life lesson\n3. FOLLOW-UP (2-3 sec): Interviewer asks for the story behind the lesson\n4. ANSWER 2 (5-8 sec): The personal story that illustrates the wisdom\n5. REACTION (2-3 sec): Interviewer reflects or connects emotionally\n6. TAGLINE (2-3 sec): The lasting takeaway viewers carry with them',
E'Generate a viral script for the topic: "{{topic}}" (related to: {{topic_context}}).{{custom_question}}\n\nWISDOM-SPECIFIC:\n- The subject speaks from decades of personal experience\n- Use age-appropriate language (clear, no slang overload)\n- Emphasize 3-6 key wisdom words in the responses\n- The closing should leave viewers with something to think about\n\nReturn ONLY valid JSON in this exact format:\n{\n  "hook_question": "the opening question or statement",\n  "guest_answer": "the guest/subject''s initial response",\n  "follow_up_question": "the interviewer''s follow-up or next beat",\n  "follow_up_answer": "the guest/subject''s second response",\n  "reaction_line": "the interviewer''s reaction or emotional beat",\n  "close_punchline": "the memorable closing line"\n}',
'gpt-4o-mini', 0.9, 600,
'{"topic_contexts": {"retirement": "life after work, pensions, purpose in retirement", "health": "wellness, aging, mobility, longevity", "legacy": "what you leave behind, life lessons, impact", "relationships": "marriage, family bonds, community connections", "wisdom": "hard-earned life lessons, advice for younger generations"}}'::jsonb);