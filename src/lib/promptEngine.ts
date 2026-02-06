import type {
  ClipType,
  ClipPlan,
  GenerateRequest,
  SubwaySceneType,
  CityStyle,
  EnergyLevel,
  SpeakerStyle,
  MotivationalSetting,
  CameraStyle,
  LightingMood,
  StreetScene,
  InterviewStyle,
  TimeOfDay,
  InterviewerType,
  InterviewerPosition,
  SubjectDemographic,
  SubjectGender,
  SubjectStyle,
  SubwayEnhancementConfig,
  SubwayLine,
  StreetEnhancementConfig,
  MotivationalEnhancementConfig,
  Neighborhood,
  AgeGroup,
} from './types';
import { generateEnhancedSubwayPrompt } from './subwayJourneyEngine';
import { generateStreetEnhancementPrompt } from './streetJourneyEngine';
import { generateMotivationalEnhancementPrompt } from './motivationalEngine';
import { buildWisdomPrompt } from './wisdomPromptEngine';
import { LINE_PERSONALITIES, NEIGHBORHOOD_PERSONALITIES, CARD_VISUAL_ANCHORS } from './constants';
import { hardenPrompt, mergeNegativePrompt, shouldApplyWisdomRules } from './promptHardening';
import { buildInterviewStyleHardening } from './interviewStyleHardening';

const NEGATIVE_PROMPT = 'no distorted faces, no extra limbs, no unreadable text, no watermarks, no logos, no celebrity lookalikes, no text overlays in video';

// === SUBWAY CARD MIC BRAND RULE ===
const SUBWAY_CARD_MIC_RULE = `
MICROPHONE RULE (MANDATORY):
- The interviewer MUST hold a flat rectangular card (subway ticket, metro card, transit pass).
- The card is used AS the microphone and is clearly visible in the frame.
- The card is held in the interviewer's hand and extended toward the subject.
- NO traditional microphones, lavaliers, headsets, boom mics, or phones used as microphones.
- The card should be plain, minimal, and realistic (no logos unless specified).
- Camera framing must clearly show the card between interviewer and subject.
`;

const SUBWAY_NEGATIVE_PROMPT = 'no handheld microphone, no lavalier mic, no boom mic, no headset mic, no visible audio equipment, no phone used as microphone, no traditional podcast microphone';

// Subway Card Mic visual anchors - reinforces the card mic in generated output
const SUBWAY_CARD_MIC_ANCHORS = `
- Interviewer's hand holding the subway card/ticket is visible and centered like a microphone.
- The card stays in frame for most of the clip.
- Use medium shot or tight two-shot; do NOT crop out hands.
- Subject speaks naturally toward the card.
`.trim();

const SUBWAY_FORBIDDEN = `
- No handheld microphones
- No lavalier microphones
- No boom microphones
- No headset microphones
- No phones used as microphones
- No podcast mics
`.trim();

// Generic interview anchors that help all interview types
const INTERVIEW_VISUAL_ANCHORS = `
- Hands visible when interviewer is interacting with subject.
- Documentary framing: mid-shot to close-up.
- Natural motion and authentic reactions.
`.trim();

// 55+ WISDOM DEFAULTS - Applied to ALL interview types by default
export const WISDOM_SYSTEM_RULES = `
CORE IDENTITY FOR ALL SUBJECTS:
- Subject is 55-75 years old with gray/silver hair visible
- Calm confidence, grounded presence, earned wisdom
- No slang, no trendy expressions, no "influencer" energy
- Voice: warm, measured, respectful, wise conversational tone

VISUAL CASTING RULES:
- Natural faces, confident posture, no filter-looks
- Wardrobe: smart casual, timeless, no logos or trendy clothes
- Warm, authentic, real-world experience vibe

WRITING STYLE:
- Short sentences, clear and direct
- Phrases like: "I've learned..." "Here's what I wish I knew..." "What matters is..."
- Optimistic realism, not toxic positivity
- Measured delivery with thoughtful pauses implied

TOPIC FRAMING:
- Money -> retirement, budgeting, avoiding scams, healthcare
- Relationships -> second marriages, empty nest, boundaries, loneliness
- Health -> mobility, sleep, stress, purpose, longevity
- Work -> reinvention, consulting, mentorship, late-career pivots
- Life -> regrets, freedom, legacy, what's worth worrying about

No stereotypes. No mocking age. No "boomer" jokes. Respectful disagreement only.
`;

const SPEAKER_STYLE_PROMPTS: Record<SpeakerStyle, string> = {
  intense_coach: 'Intense motivational speaker with drill sergeant energy, leaning forward, commanding presence, finger pointing, veins showing, passionate delivery',
  calm_mentor: 'Wise mentor figure speaking calmly, measured delivery, thoughtful pauses, warm eye contact, open body language, reassuring presence',
  hype_man: 'High energy hype speaker, animated gestures, jumping movements, crowd-pumping enthusiasm, infectious energy, rapid delivery',
  wise_elder: 'Experienced elder figure, sage-like delivery, weathered wisdom, deliberate speech, knowing looks, earned authority',
  corporate_exec: 'Polished business executive, tailored suit, confident posture, boardroom presence, strategic gestures, professional gravitas',
  athlete: 'Athletic speaker, physical intensity, competitor mindset, powerful stance, disciplined energy, sports imagery',
};

const SETTING_PROMPTS: Record<MotivationalSetting, string> = {
  gym: 'Commercial gym setting, weight racks visible, rubber floor, industrial lighting, mirrors in background, iron and sweat atmosphere',
  stage: 'Conference stage with dramatic spotlights, audience silhouettes visible, professional sound setup, LED screens behind, keynote speaker environment',
  outdoor: 'Outdoor location with epic natural backdrop, mountains or ocean visible, wind in hair, golden sunlight, adventure lifestyle setting',
  studio: 'Clean podcast studio setup, professional microphones visible, acoustic panels, ring lights, content creator aesthetic',
  urban_rooftop: 'Urban rooftop at sunset, city skyline in background, concrete and glass towers, success lifestyle environment',
  office: 'Executive corner office, floor-to-ceiling windows, city views, leather furniture, success and achievement environment',
  locker_room: 'Sports team locker room, metal lockers, wooden benches, pre-game intensity, team motivation environment',
};

const CAMERA_STYLE_PROMPTS: Record<CameraStyle, string> = {
  dramatic_push: 'Camera slowly pushes in toward subject, building intensity, narrowing focus, cinematic zoom effect',
  slow_orbit: 'Camera slowly orbits around subject, epic 360 movement, dynamic perspective shift, reveals environment',
  tight_closeup: 'Extreme close-up on face, eyes and expression fill frame, intimate and intense, emotional detail visible',
  wide_epic: 'Wide establishing shot showing subject in grand environment, scale and context, inspirational framing',
  handheld_raw: 'Handheld camera with slight natural shake, documentary authenticity, raw unpolished feel, in-the-moment',
};

const LIGHTING_PROMPTS: Record<LightingMood, string> = {
  golden_hour: 'Golden hour warm lighting, sunset tones, cinematic amber glow, soft shadows, magical hour aesthetic',
  dramatic_shadows: 'High contrast dramatic lighting, deep shadows on face, moody atmosphere, rembrandt lighting style',
  high_contrast: 'Bold high contrast lighting, punchy blacks and whites, graphic quality, strong visual impact',
  studio_clean: 'Professional studio lighting, even soft light, flattering on face, broadcast quality, clean aesthetic',
  moody_backlit: 'Backlit silhouette edges, atmospheric halo effect, mysterious mood, rim lighting on subject',
};

const STREET_SCENE_PROMPTS: Record<StreetScene, string> = {
  busy_sidewalk: 'Busy city sidewalk, high pedestrian traffic, urban energy, people walking past in background',
  coffee_shop_exterior: 'Coffee shop patio exterior, cafe tables visible, relaxed urban environment, neighborhood vibe',
  park_bench: 'City park setting, green trees and grass, park bench visible, nature within urban environment',
  crosswalk: 'Street intersection with crosswalk, traffic movement, urban crossing, city pulse',
  shopping_district: 'Upscale shopping district, storefronts and window displays, affluent urban area',
  quiet_neighborhood: 'Quiet residential neighborhood, brownstones or houses visible, intimate community feel',
};

const INTERVIEW_STYLE_PROMPTS: Record<InterviewStyle, string> = {
  quick_fire: 'Quick fire interview pacing, rapid questions, punchy responses, energetic back and forth',
  deep_conversation: 'Deep conversation style, thoughtful pauses, philosophical exchange, meaningful dialogue',
  man_on_street: 'Classic man on the street approach, casual stop, spontaneous answers, vox pop style',
  ambush_style: 'Ambush interview style, caught off guard reactions, surprised expressions, raw unfiltered response',
  friendly_chat: 'Friendly conversation approach, warm rapport, comfortable exchange, genuine connection',
  hot_take: 'Hot take delivery, bold confident opinion, controversial stance, unwavering conviction, mic drop energy',
  confessional: 'Confessional intimate moment, vulnerable sharing, personal revelation, emotional authenticity, close whispered tone',
  debate_challenge: 'Debate challenge format, defending position, push-back energy, intellectual sparring, point-counterpoint dynamic',
  reaction_test: 'Reaction test scenario, reading prompt or statement, genuine surprise or shock, unfiltered first impression, authentic response moment',
  serious_probe: 'Serious investigative probe, pressing questions, searching for truth, journalist intensity, accountability interview style',
  storytelling: 'Storytelling narrative mode, recounting personal experience, expressive hand gestures, vivid memory recall, captivating anecdote delivery',
  unpopular_opinion: 'Unpopular opinion format, defending controversial stance, expecting pushback, bold declaration, conviction despite opposition',
  exposed_callout: 'Expose industry secrets format, revealing hidden truths, insider knowledge, whistleblowing energy, breaking fourth wall',
  red_flag_detector: 'Red flag detection mode, identifying warning signs, skepticism, cautionary tone, teaching moment, pattern recognition',
  hot_take_react: 'Hot take reaction style, responding to trending topics, real-time commentary, immediate opinion, trending topic energy',
  confessions: 'Confession format, personal story sharing, intimate revelation, emotional vulnerability, therapeutic sharing, cathartic moment',
  before_after_story: 'Before and after transformation journey, dramatic change narrative, personal growth story, dramatic contrast, inspiring transformation',
  finish_sentence: 'Finish the sentence prompt, completing thought, collaborative storytelling, creative completion, interactive format',
  one_piece_advice: 'One piece of advice delivery, single powerful tip, memorable takeaway, wisdom bomb, impactful guidance moment',
  would_you_rather: 'Would you rather format, choosing between options, preference reveal, debate energy, fun polarization',
  street_quiz: 'Street quiz format, trick questions, knowledge test, surprising answers, quiz show energy, trivia challenge',
};

const TIME_OF_DAY_PROMPTS: Record<TimeOfDay, string> = {
  early_morning: '5AM quiet platforms, sleepy commuters, early risers, peaceful dawn atmosphere',
  morning_rush: '7-9AM packed trains, coffee-fueled energy, hurried commuters, peak morning chaos',
  midday: 'Midday bright sunlight, harsh shadows, lunch crowd activity, peak daylight',
  evening_rush: '5-7PM tired commuters heading home, social energy, end of workday vibe',
  late_night: '11PM+ nearly empty platforms, mysterious atmosphere, night owls, quiet solitude',
  weekend: 'Weekend relaxed vibe, tourists, different energy, non-commuter crowd',
  golden_hour: 'Golden hour sunset glow, warm light, magic hour beauty, cinematic tones',
  dusk: 'Dusk blue hour, city lights beginning, transitional light, evening atmosphere',
  night: 'Nighttime urban setting, street lights illumination, neon signs, city nightlife energy',
};

const INTERVIEWER_TYPE_PROMPTS: Record<InterviewerType, string> = {
  podcaster: 'Professional host vibe, confident media presence, practiced interviewing style (no visible traditional mic hardware).',
  documentary_journalist: 'Serious documentary interviewer demeanor, authentic street journalism energy (no visible traditional mic hardware).',
  casual_creator: 'Casual creator vibe, approachable, authentic energy, natural conversation flow (no visible traditional mic hardware).',
  news_reporter: 'Broadcast reporter vibe and delivery, confident and professional (no visible traditional mic hardware).',
  hidden_voice_only: 'Interviewer off-camera; only hand is visible extending the subway card/ticket toward subject.',
};

const INTERVIEWER_POSITION_PROMPTS: Record<InterviewerPosition, string> = {
  holding_mic: 'Interviewer holding a flat subway card or transit pass in hand, extending it toward the subject AS the microphone. The card is clearly visible and central in the frame.',
  handheld_pov: "First-person POV from interviewer perspective. The interviewer's hand is visible holding a subway card or transit pass forward like a microphone.",
  two_shot_visible: 'Wide two-shot showing both interviewer and subject. Interviewer\'s hand holding a subway card is clearly visible between them, used as the mic.',
  over_shoulder: 'Over-the-shoulder shot from behind interviewer. Focus on subject face but interviewer\'s hand holding the subway card mic is visible in frame.',
};

const SUBJECT_DEMOGRAPHIC_PROMPTS: Record<SubjectDemographic, string> = {
  any: 'Random everyday person, authentic street casting, diverse representation',
  young_professional: 'Young professional in their late 20s to mid 30s, career-focused appearance, confident posture',
  college_student: 'College-age student, youthful energy, casual student style, early 20s appearance',
  middle_aged: 'Middle-aged person, experienced presence, mature demeanor, 40s to 50s appearance',
  senior: 'Senior citizen, wise appearance, life experience visible, 60+ years old with gray or silver hair',
  business_exec: 'Business executive type, power presence, leadership demeanor, successful appearance',
  creative_type: 'Creative professional, artistic appearance, unique personal style, designer or artist vibe',
  fitness_enthusiast: 'Fitness-focused person, athletic build, healthy appearance, gym-goer energy',
};

const SUBJECT_GENDER_PROMPTS: Record<SubjectGender, string> = {
  any: '',
  male: 'male subject',
  female: 'female subject',
};

const SUBJECT_STYLE_PROMPTS: Record<SubjectStyle, string> = {
  casual: 'casual everyday clothing, comfortable and relaxed attire, timeless style',
  streetwear: 'urban streetwear fashion, sneakers, hoodies, contemporary street style',
  business_casual: 'smart casual office attire, polished but relaxed professional look',
  athletic: 'athletic wear, gym clothes, activewear, sporty appearance',
  bohemian: 'bohemian artistic style, eclectic fashion, creative personal expression',
  corporate: 'formal corporate attire, business suit, professional executive appearance',
};

const SCENE_PROMPTS: Record<SubwaySceneType, string> = {
  platform_waiting: 'Subject standing on subway platform waiting for train, train arriving in background, platform edge visible',
  inside_train: 'Subject seated or standing inside moving subway car, windows showing tunnel motion, other passengers visible',
  train_arriving: 'Dramatic moment as subway doors slide open, subject visible through doors, passengers stepping on/off',
  rush_hour: 'Crowded platform during rush hour, dense pack of commuters, chaotic energy, movement all around',
  late_night: 'Nearly empty subway platform at night, moody fluorescent lighting, few scattered passengers, quiet atmosphere',
  walking_through: 'Subject walking through subway station corridor, turnstiles or stairs visible, other commuters passing',
};

const CITY_VISUAL_CUES: Record<CityStyle, string> = {
  nyc: `New York City MTA subway aesthetic, white tile walls with colored trim, yellow platform edge safety line, classic NYC station signage, green globe lights at entrance.\n\nINTERVIEWER CARD MIC: Hold MetroCard - rectangular white plastic card with blue/orange stripe, tapped against fare reader. Card is visible in hand showing the stripe. Casual NYC commuter gesture.`,
  london: `London Underground aesthetic, rounded tunnel walls, Mind the Gap platform warning, roundel logo visible, deep escalators, brown and cream tiles.\n\nINTERVIEWER CARD MIC: Hold Oyster card - distinctive brown rounded rectangular card with contactless symbol, shown in palm ready to tap. Iconic London Underground gesture.`,
  tokyo: `Tokyo Metro aesthetic, ultra-clean platforms, organized queuing lines on floor, digital screens, bright white lighting, orderly commuters.\n\nINTERVIEWER CARD MIC: Hold Suica/ICOCA/Pasmo - thin RFID card, quick tap motion between thumb and finger. Card shows cute character design.`,
  paris: `Paris Metro aesthetic, Art Nouveau entrance style, dark green railings, vintage tilework, Metropolitain signage, narrow platforms.\n\nINTERVIEWER CARD MIC: Hold Navigo card - rectangular card with weekly/monthly pass display window, displayed to show validation strip. Classic French transit card handling.`,
  generic: `Generic modern urban subway station, concrete pillars, fluorescent lighting, standard transit infrastructure.\n\nINTERVIEWER CARD MIC: Hold generic transit card - plain rectangular card without prominent branding, used as microphone.`,
};

const ENERGY_DESCRIPTIONS: Record<EnergyLevel, string> = {
  calm: 'Subject gives calm, thoughtful response, relaxed body language, contemplative expression, measured speaking pace',
  conversational: 'Subject responds naturally and conversationally, friendly demeanor, easy engagement, authentic dialogue feel',
  high_energy: 'Subject responds with animated energy, expressive gestures, enthusiastic reactions, dynamic presence',
  chaotic: 'Subject gives wild, unexpected reaction, surprised expressions, dramatic gestures, unpredictable energy',
};

function buildEnhancedMotivationalPrompt(
  topic: string,
  duration: number,
  options: {
    speakerStyle?: SpeakerStyle;
    setting?: MotivationalSetting;
    cameraStyle?: CameraStyle;
    lightingMood?: LightingMood;
    angle?: string;
    motivationalEnhancements?: MotivationalEnhancementConfig;
  }
): string {
  const { speakerStyle, setting, cameraStyle, lightingMood, angle, motivationalEnhancements } = options;

  const speakerDesc = speakerStyle ? SPEAKER_STYLE_PROMPTS[speakerStyle] : SPEAKER_STYLE_PROMPTS.intense_coach;
  const settingDesc = setting ? SETTING_PROMPTS[setting] : SETTING_PROMPTS.gym;
  const cameraDesc = cameraStyle ? CAMERA_STYLE_PROMPTS[cameraStyle] : CAMERA_STYLE_PROMPTS.dramatic_push;
  const lightingDesc = lightingMood ? LIGHTING_PROMPTS[lightingMood] : LIGHTING_PROMPTS.dramatic_shadows;

  let basePrompt = `Vertical 9:16 motivational speaker video clip, ${duration} seconds.

Speaker: ${speakerDesc}
Topic: ${topic} - delivering powerful message about this theme.

Setting: ${settingDesc}
Camera: ${cameraDesc}
Lighting: ${lightingDesc}

Mood: determined, powerful, inspiring, relentless, viral-worthy intensity.
The speaker is mid-delivery of an impactful motivational speech moment.

No comedy, no parody, no text inside the video frame.
Single continuous shot. Capture the raw emotion and intensity.`;

  // Apply motivational enhancements if provided
  if (motivationalEnhancements) {
    basePrompt = generateMotivationalEnhancementPrompt(motivationalEnhancements) + '\n\n' + basePrompt;
  }

  if (angle) {
    return `${basePrompt}\nSpecific creative direction: ${angle}`;
  }
  return basePrompt;
}

interface CharacterOptions {
  interviewerType?: InterviewerType;
  interviewerPosition?: InterviewerPosition;
  subjectDemographic?: SubjectDemographic;
  subjectGender?: SubjectGender;
  subjectStyle?: SubjectStyle;
}

function buildCharacterDescription(options: CharacterOptions): string {
  const {
    interviewerType,
    interviewerPosition,
    subjectDemographic,
    subjectGender,
    subjectStyle,
  } = options;

  const parts: string[] = [];

  if (interviewerType) {
    parts.push(`Interviewer: ${INTERVIEWER_TYPE_PROMPTS[interviewerType]}`);
  }
  if (interviewerPosition) {
    parts.push(`Shot setup: ${INTERVIEWER_POSITION_PROMPTS[interviewerPosition]}`);
  }

  const subjectParts: string[] = [];
  if (subjectGender && subjectGender !== 'any') {
    subjectParts.push(SUBJECT_GENDER_PROMPTS[subjectGender]);
  }
  if (subjectDemographic) {
    subjectParts.push(SUBJECT_DEMOGRAPHIC_PROMPTS[subjectDemographic]);
  }
  if (subjectStyle) {
    subjectParts.push(SUBJECT_STYLE_PROMPTS[subjectStyle]);
  }

  if (subjectParts.length > 0) {
    parts.push(`Subject: ${subjectParts.join(', ')}`);
  }

  return parts.join('\n');
}

function buildEnhancedStreetInterviewPrompt(
  topic: string,
  duration: number,
  options: {
    streetScene?: StreetScene;
    interviewStyle?: InterviewStyle;
    timeOfDay?: TimeOfDay;
    energyLevel?: EnergyLevel;
    angle?: string;
    interviewerType?: InterviewerType;
    interviewerPosition?: InterviewerPosition;
    subjectDemographic?: SubjectDemographic;
    subjectGender?: SubjectGender;
    subjectStyle?: SubjectStyle;
    neighborhood?: Neighborhood;
    streetEnhancements?: StreetEnhancementConfig;
  }
): string {
  const {
    streetScene,
    interviewStyle,
    timeOfDay,
    energyLevel,
    angle,
    interviewerType,
    interviewerPosition,
    subjectDemographic,
    subjectGender,
    subjectStyle,
    neighborhood,
    streetEnhancements,
  } = options;

  const sceneDesc = streetScene ? STREET_SCENE_PROMPTS[streetScene] : STREET_SCENE_PROMPTS.busy_sidewalk;
  const styleDesc = interviewStyle ? INTERVIEW_STYLE_PROMPTS[interviewStyle] : INTERVIEW_STYLE_PROMPTS.man_on_street;
  const timeDesc = timeOfDay ? TIME_OF_DAY_PROMPTS[timeOfDay] : TIME_OF_DAY_PROMPTS.midday;
  const energyDesc = energyLevel ? ENERGY_DESCRIPTIONS[energyLevel] : ENERGY_DESCRIPTIONS.conversational;

  const characterDesc = buildCharacterDescription({
    interviewerType,
    interviewerPosition,
    subjectDemographic,
    subjectGender,
    subjectStyle,
  });

  let locationDesc = sceneDesc;
  if (neighborhood) {
    const personality = NEIGHBORHOOD_PERSONALITIES[neighborhood];
    locationDesc = `${personality.atmosphere}. ${sceneDesc}`;
  }

  let basePrompt = `Realistic street interview clip, documentary style, ${duration} seconds.
Vertical 9:16 format. Handheld camera, authentic feel.

Location: ${locationDesc}
Time: ${timeDesc}
Interview approach: ${styleDesc}

${characterDesc}

Topic: Candid interview moment about ${topic.toLowerCase()}.
${energyDesc}

Camera: Handheld mid-shot to close-up, shallow depth of field, slight natural shake.
Lighting: Natural available light appropriate for time of day.
Mood: authentic, spontaneous, real, candid, viral-worthy moment.

No text inside the video frame. Single continuous shot. Capture genuine human moment.`;

  // Apply street enhancements if provided
  if (streetEnhancements) {
    basePrompt = generateStreetEnhancementPrompt(streetEnhancements) + '\n\n' + basePrompt;
  }

  if (angle) {
    return `${basePrompt}\nSpecific creative direction: ${angle}`;
  }
  return basePrompt;
}

function buildEnhancedSubwayPrompt(
  topic: string,
  duration: number,
  options: {
    question?: string;
    sceneType?: SubwaySceneType;
    cityStyle?: CityStyle;
    energyLevel?: EnergyLevel;
    interviewStyle?: InterviewStyle;
    angle?: string;
    interviewerType?: InterviewerType;
    interviewerPosition?: InterviewerPosition;
    subjectDemographic?: SubjectDemographic;
    subjectGender?: SubjectGender;
    subjectStyle?: SubjectStyle;
    subwayLine?: SubwayLine;
    subwayEnhancements?: SubwayEnhancementConfig;
  }
): string {
  const {
    question,
    sceneType,
    cityStyle,
    energyLevel,
    interviewStyle,
    angle,
    interviewerType,
    interviewerPosition,
    subjectDemographic,
    subjectGender,
    subjectStyle,
    subwayLine,
    subwayEnhancements,
  } = options;

  const sceneSetting = sceneType ? SCENE_PROMPTS[sceneType] : SCENE_PROMPTS.platform_waiting;
  const cityVisuals = cityStyle ? CITY_VISUAL_CUES[cityStyle] : CITY_VISUAL_CUES.nyc;
  const energyDesc = energyLevel ? ENERGY_DESCRIPTIONS[energyLevel] : ENERGY_DESCRIPTIONS.conversational;
  const styleDesc = interviewStyle ? INTERVIEW_STYLE_PROMPTS[interviewStyle] : INTERVIEW_STYLE_PROMPTS.man_on_street;

  const characterDesc = buildCharacterDescription({
    interviewerType,
    interviewerPosition,
    subjectDemographic,
    subjectGender,
    subjectStyle,
  });

  const questionContext = question
    ? `Being asked: "${question}" - capture authentic reaction to this specific question.`
    : `Candid interview moment about ${topic.toLowerCase()}, authentic reactions.`;

  // Get city-specific card visual anchors
  // Subway card mic camera framing rules
  const CARD_MIC_CAMERA_RULES = `\nVisual Anchor (CRITICAL):\n- Close or medium shot clearly showing the interviewer's hand holding a subway card.\n- The card is positioned where a microphone would normally be.\n- Subject speaks toward the card naturally.\n- Card remains visible for most of the clip.\n\nCamera Framing (CRITICAL):\n- Medium close-up or tight two-shot showing interviewer and subject.\n- Interviewer's hand holding the subway card MUST be visible in frame.\n- Avoid extreme close-ups that hide the interviewer's hand.\n- Hands must be visible in frame - the card must NOT be cropped out.\n`;

  const basePrompt = `${SUBWAY_CARD_MIC_RULE}\n\nRealistic viral subway interview clip, SubwayTakes documentary style, ${duration} seconds.
Vertical 9:16 format. Handheld camera, raw authentic feel.

Location: ${cityVisuals}
Scene: ${sceneSetting}
Interview approach: ${styleDesc}

${characterDesc}

Topic: ${questionContext}
${energyDesc}

Visual elements: Include subway ambience - train sounds, announcement echoes, commuters passing, platform activity.
${CARD_MIC_CAMERA_RULES}
Camera: Handheld documentary style, shallow depth of field, intimate framing, slight natural shake.
Lighting: Natural station lighting, harsh fluorescent mixed with warmer tones.
Mood: Urban, raw, authentic, spontaneous, real city life, viral-worthy moment.

No text inside the video frame. Single continuous shot. Capture genuine human moment.`;

  let finalPrompt = basePrompt;
  
  // Add subway line personality
  if (subwayLine && subwayLine !== 'any') {
    const personality = LINE_PERSONALITIES[subwayLine];
    finalPrompt += `\n\nSubway Line Vibe: ${personality.vibe}. This is the ${subwayLine} train - ${personality.atmosphere}.`;
  }
  
  // Apply enhancements if provided
  if (subwayEnhancements) {
    finalPrompt = generateEnhancedSubwayPrompt(finalPrompt, subwayEnhancements);
  }
  
  if (angle) {
    finalPrompt += `\n\nSpecific creative direction: ${angle}`;
  }

  // Apply interview style hardening
  const styleHardening = buildInterviewStyleHardening(interviewStyle);
  if (styleHardening) {
    finalPrompt += styleHardening;
  }

  // Add QA self-check
  finalPrompt += `\n\nFinal QA Check (CRITICAL):\n- If the card used as the microphone is not clearly visible, regenerate the scene.\n- Do not proceed unless the subway card is present and being used as the mic.`;

  return finalPrompt;
}

function buildProviderPrompt(request: GenerateRequest): string {
  const {
    videoType,
    topic,
    durationSeconds,
    anglePrompt,
    interviewQuestion,
    sceneType,
    cityStyle,
    energyLevel,
    speakerStyle,
    motivationalSetting,
    cameraStyle,
    lightingMood,
    streetScene,
    interviewStyle,
    timeOfDay,
    interviewerType,
    interviewerPosition,
    subjectDemographic,
    subjectGender,
    subjectStyle,
  } = request;

  switch (videoType) {
    case 'motivational':
      return buildEnhancedMotivationalPrompt(topic, durationSeconds, {
        speakerStyle,
        setting: motivationalSetting,
        cameraStyle,
        lightingMood,
        angle: anglePrompt,
        motivationalEnhancements: request.motivationalEnhancements,
      });
    case 'street_interview':
      return buildEnhancedStreetInterviewPrompt(topic, durationSeconds, {
        streetScene,
        interviewStyle,
        timeOfDay,
        energyLevel,
        angle: anglePrompt,
        interviewerType,
        interviewerPosition,
        subjectDemographic,
        subjectGender,
        subjectStyle,
        neighborhood: request.neighborhood,
        streetEnhancements: request.streetEnhancements,
      });
    case 'subway_interview':
      return buildEnhancedSubwayPrompt(topic, durationSeconds, {
        question: interviewQuestion,
        sceneType,
        cityStyle,
        energyLevel,
        interviewStyle,
        angle: anglePrompt,
        interviewerType,
        interviewerPosition,
        subjectDemographic,
        subjectGender,
        subjectStyle,
        subwayLine: request.subwayLine,
        subwayEnhancements: request.subwayEnhancements,
      });
    case 'studio_interview':
      // Studio interview uses subway prompt with studio modifications for now
      return buildEnhancedSubwayPrompt(topic, durationSeconds, {
        question: interviewQuestion,
        angle: anglePrompt,
        interviewerType,
        interviewerPosition,
        subjectDemographic,
        subjectGender,
        subjectStyle,
      });
    case 'wisdom_interview':
      return buildWisdomPrompt(topic, durationSeconds, {
        tone: request.wisdomTone,
        angle: anglePrompt,
      });
    default:
      return buildEnhancedSubwayPrompt(topic, durationSeconds, {
        question: interviewQuestion,
        sceneType,
        cityStyle,
        energyLevel,
        interviewStyle,
        angle: anglePrompt,
      });
  }
}

function generateVariationHint(type: ClipType): string {
  const hints: Record<ClipType, string[]> = {
    motivational: [
      'different speaker intensity',
      'vary the camera movement timing',
      'different lighting angle',
      'alter speaker positioning',
      'change background activity',
      'vary emotional peak moment',
    ],
    street_interview: [
      'different pedestrian density',
      'vary the background activity',
      'change interviewee position',
      'alter street atmosphere',
      'different crowd reactions',
      'vary lighting conditions',
    ],
    subway_interview: [
      'different platform angle',
      'vary commuter density',
      'change train timing',
      'alter station lighting',
      'different subject reaction intensity',
      'vary background passenger activity',
    ],
    studio_interview: [
      'different camera angle',
      'vary lighting setup',
      'change guest positioning',
      'alter background elements',
      'different energy level',
      'vary shot composition',
    ],
    wisdom_interview: [
      'different tone (gentle/direct/funny/heartfelt)',
      'vary subject demographic',
      'change setting location',
      'alter emotional intensity',
      'different pacing of advice',
      'vary storytelling approach',
    ],
  };

  const options = hints[type];
  return options[Math.floor(Math.random() * options.length)];

}

export function createClipPlan(request: GenerateRequest): ClipPlan {
  const { videoType, topic, durationSeconds } = request;

  // 1) Build the base prompt (your existing builder)
  let base = buildProviderPrompt(request);

  // 2) Apply wisdom rules only when appropriate
  if (shouldApplyWisdomRules(request)) {
    base = `${WISDOM_SYSTEM_RULES}\n\n${base}`;
  }

  // 3) Harden prompt with consistent sections + strong anchors/forbidden
  let provider_prompt = base;

  if (videoType === 'subway_interview') {
    provider_prompt = hardenPrompt(provider_prompt, request, {
      systemRules: SUBWAY_CARD_MIC_RULE.trim(),
      visualAnchors: `${SUBWAY_CARD_MIC_ANCHORS}\n${INTERVIEW_VISUAL_ANCHORS}`,
      forbidden: SUBWAY_FORBIDDEN,
    });
  } else if (videoType === 'street_interview' || videoType === 'studio_interview') {
    provider_prompt = hardenPrompt(provider_prompt, request, {
      visualAnchors: INTERVIEW_VISUAL_ANCHORS,
    });
  } else {
    provider_prompt = hardenPrompt(provider_prompt, request);
  }

  // 4) Negative prompts - make subway stricter
  const negative_prompt =
    videoType === 'subway_interview'
      ? mergeNegativePrompt(NEGATIVE_PROMPT, SUBWAY_NEGATIVE_PROMPT)
      : NEGATIVE_PROMPT;

  return {
    provider_prompt,
    negative_prompt,
    video_type: videoType,
    topic,
    duration_seconds: durationSeconds,
    aspect_ratio: '9:16',
    variation_hint: generateVariationHint(videoType),
  };
}

export function createVariationPrompt(originalPrompt: string): string {
  return `${originalPrompt}
\nVARIATION RULES:
- Change camera angle, background elements, micro-movements.
- KEEP all mandatory system rules and visual anchors unchanged.
- Keep it realistic and documentary.
`.trim();
}

export function createBatchVariationPrompt(basePrompt: string, sequence: number, total: number): string {
  const variations = [
    'different subject demographic, maintain same energy',
    'slightly different camera angle, same framing style',
    'vary background commuter activity, keep focus on subject',
    'different reaction timing, same authentic feel',
    'adjust crowd density, maintain intimate interview feel',
    'vary lighting intensity, keep documentary aesthetic',
    'different platform position, same scene type',
    'change subject body language, same mood',
    'vary train timing in background, keep focus on interview',
    'different station elements visible, maintain city style',
  ];

  const variationIndex = (sequence - 1) % variations.length;
  return `${basePrompt}
\nBATCH VARIATION ${sequence}/${total}:
${variations[variationIndex]}
\nRULE: Do not violate mandatory rules/anchors.
`.trim();
}

// === AGE-APPROPRIATE PROMPT GENERATION ===

// Age-appropriate language modifiers for prompts
const AGE_GROUP_MODIFIERS: Record<AgeGroup, {
  tone: string;
  vocabulary: string;
  contentWarnings: string[];
  styleHints: string[];
}> = {
  kids: {
    tone: 'fun, educational, encouraging, positive',
    vocabulary: 'simple and easy to understand language, no complex jargon',
    contentWarnings: ['no mature themes', 'no adult situations', 'no controversial politics', 'no explicit content'],
    styleHints: ['bright and cheerful energy', 'colorful environment', 'uplifting messages', 'inspiring for young audiences'],
  },
  teens: {
    tone: 'relatable, trendy, authentic, engaging',
    vocabulary: 'casual teen-friendly language, relatable references',
    contentWarnings: ['no explicit adult content', 'no graphic violence', 'no dangerous stunts'],
    styleHints: ['modern and current', 'social media friendly', 'shareable content', 'authentic voice'],
  },
  older_adults: {
    tone: 'reflective, experienced, wise, storytelling',
    vocabulary: 'nuanced perspectives drawn from decades of experience',
    contentWarnings: [], // Older adults can handle most content
    styleHints: ['authentic slow-paced delivery', 'thoughtful pauses', 'hard-earned wisdom', 'storytelling approach'],
  },
  adults: {
    tone: 'mature, professional, sophisticated',
    vocabulary: 'adult-level vocabulary, nuanced perspectives',
    contentWarnings: [], // Adults can handle most content
    styleHints: ['mature themes allowed', 'complex discussions welcome', 'candid and honest'],
  },
  all_ages: {
    tone: 'universal, family-friendly, inclusive',
    vocabulary: 'accessible language that works for all ages',
    contentWarnings: ['no explicit content', 'no controversial mature themes', 'no graphic content'],
    styleHints: ['broad appeal', 'shareable with family', 'wholesome entertainment', 'positive messaging'],
  },
};

// Interview mode modifiers by age group
const MODE_AGE_MODIFIERS: Record<AgeGroup, Record<string, string>> = {
  kids: {
    hot_take_challenge: 'fun opinions on kid-friendly topics like snacks, toys, games',
    rapid_fire_round: 'quick and exciting questions about fun topics',
    deep_dive_interview: 'thoughtful questions about dreams, goals, and feelings',
    myth_busters: 'fun facts and reality vs fiction about interesting topics',
    would_you_rather: 'fun choices between favorite things',
    story_time: 'exciting stories about adventures and achievements',
    unpopular_opinion: 'fun opinions about preferences like pizza toppings or colors',
    expert_take: 'learned knowledge about interesting subjects',
    none: 'friendly conversation about fun topics',
  },
  teens: {
    hot_take_challenge: 'bold opinions on trending topics',
    rapid_fire_round: 'rapid questions on hot topics',
    deep_dive_interview: 'meaningful discussion on personal growth',
    myth_busters: 'separating fact from fiction on teen topics',
    would_you_rather: 'choices on social trends and preferences',
    story_time: 'relatable teen experiences and stories',
    unpopular_opinion: 'controversial takes on modern life',
    expert_take: 'authority on trending topics',
    none: 'casual conversation',
  },
  older_adults: {
    hot_take_challenge: 'spicy opinions on life lessons and wisdom',
    rapid_fire_round: 'quick takes on career and retirement',
    deep_dive_interview: 'philosophical exploration of life experiences',
    myth_busters: 'debunking myths about aging and life',
    would_you_rather: 'life choices and priorities',
    story_time: 'personal growth stories and hard-won wisdom',
    unpopular_opinion: 'unpopular but honest life opinions',
    expert_take: 'expertise on career and life experience',
    none: 'reflective conversation',
  },
  adults: {
    hot_take_challenge: 'controversial opinions on mature topics',
    rapid_fire_round: 'quick takes on real-world issues',
    deep_dive_interview: 'nuanced exploration of complex topics',
    myth_busters: 'challenging conventional wisdom',
    would_you_rather: 'adult life trade-offs',
    story_time: 'life experiences and hard-won wisdom',
    unpopular_opinion: 'candid controversial takes',
    expert_take: 'authority on professional topics',
    none: 'candid discussion',
  },
  all_ages: {
    hot_take_challenge: 'fun opinions on universal preferences',
    rapid_fire_round: 'quick-fire questions on interesting topics',
    deep_dive_interview: 'thoughtful exploration of universal themes',
    myth_busters: 'fun facts about everyday things',
    would_you_rather: 'choices everyone can relate to',
    story_time: 'universal stories of human experience',
    unpopular_opinion: 'light controversial opinions',
    expert_take: 'interesting knowledge sharing',
    none: 'friendly conversation',
  },
};

/**
 * Generate age-appropriate prompt modifiers
 */
export function getAgeGroupModifiers(ageGroup: AgeGroup): string[] {
  const modifiers = AGE_GROUP_MODIFIERS[ageGroup];
  return [
    `Tone: ${modifiers.tone}`,
    `Vocabulary: ${modifiers.vocabulary}`,
    ...modifiers.contentWarnings.map(w => w),
    ...modifiers.styleHints.map(h => h),
  ];
}

/**
 * Get mode-specific modifier for age group
 */
export function getModeAgeModifier(mode: string, ageGroup: AgeGroup): string {
  return MODE_AGE_MODIFIERS[ageGroup]?.[mode] || '';
}

/**
 * Build an age-appropriate prompt modifier string
 */
export function buildAgeAppropriatePrompt(
  basePrompt: string,
  ageGroup: AgeGroup,
  mode?: string
): string {
  const modifiers = getAgeGroupModifiers(ageGroup);
  const modeModifier = mode ? getModeAgeModifier(mode, ageGroup) : '';
  
  let ageSection = `\n\n=== AGE-APPROPRIATE CONTENT ===`;
  ageSection += `\nTarget Audience: ${ageGroup.replace('_', ' ').toUpperCase()}`;
  ageSection += `\n${modifiers.join('\n')}`;
  
  if (modeModifier) {
    ageSection += `\n\nMode Adaptation: ${modeModifier}`;
  }
  
  return `${basePrompt}${ageSection}`;
}

/**
 * Add age-appropriate modifications to existing prompt builders
 */
export function addAgeModifiersToPrompt(
  prompt: string,
  ageGroup: AgeGroup,
  mode?: string
): string {
  if (!ageGroup || ageGroup === 'all_ages') {
    return prompt; // No modification needed for all_ages
  }
  
  return buildAgeAppropriatePrompt(prompt, ageGroup, mode);
}

/**
 * Validate that content is appropriate for the age group
 */
export function validateContentForAgeGroup(
  topic: string,
  interviewQuestion: string | null,
  ageGroup: AgeGroup
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  const modifiers = AGE_GROUP_MODIFIERS[ageGroup];
  
  // Check for potential issues in topic
  if (ageGroup === 'kids') {
    const maturePatterns = ['sex', 'dating', 'politics', 'money', 'alcohol', 'drugs'];
    maturePatterns.forEach(pattern => {
      if (topic.toLowerCase().includes(pattern)) {
        warnings.push(`Topic may not be ideal for kids: ${topic}`);
      }
    });
  }
  
  if (interviewQuestion) {
    if (ageGroup === 'kids') {
      const kidInappropriate = ['sex', 'dating', 'alcohol', 'drugs', 'work', 'career'];
      kidInappropriate.forEach(pattern => {
        if (interviewQuestion.toLowerCase().includes(pattern)) {
          warnings.push(`Question may not be appropriate for kids`);
        }
      });
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}
