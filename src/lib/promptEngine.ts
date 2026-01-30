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
} from './types';

const NEGATIVE_PROMPT = 'no distorted faces, no extra limbs, no unreadable text, no watermarks, no logos, no celebrity lookalikes, no text overlays in video';

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
};

const TIME_OF_DAY_PROMPTS: Record<TimeOfDay, string> = {
  morning: 'Morning daylight, fresh early light, commuter energy, new day atmosphere',
  midday: 'Midday bright sunlight, harsh shadows, lunch crowd activity, peak daylight',
  golden_hour: 'Golden hour sunset glow, warm light, magic hour beauty, cinematic tones',
  dusk: 'Dusk blue hour, city lights beginning, transitional light, evening atmosphere',
  night: 'Nighttime urban setting, street lights illumination, neon signs, city nightlife energy',
};

const INTERVIEWER_TYPE_PROMPTS: Record<InterviewerType, string> = {
  podcaster: 'Professional podcast host with branded microphone, confident media presence, practiced interviewing style',
  documentary_journalist: 'Serious documentary journalist, handheld reporter mic, press credentials visible, investigative demeanor',
  casual_creator: 'Casual content creator, smartphone or small camera visible, influencer energy, approachable vibe',
  news_reporter: 'Broadcast news reporter style, professional appearance, news microphone with logo, formal interviewing technique',
  hidden_voice_only: 'Interviewer off-camera, only microphone and hand visible extending toward subject, POV perspective',
};

const INTERVIEWER_POSITION_PROMPTS: Record<InterviewerPosition, string> = {
  holding_mic: 'Interviewer holding microphone extended toward subject, classic interview framing, mic visible in shot',
  handheld_pov: 'First-person POV from interviewer perspective, camera moving with interviewer, immersive documentary feel',
  two_shot_visible: 'Wide two-shot showing both interviewer and subject, conversation framing, both faces visible',
  over_shoulder: 'Over-the-shoulder shot from behind interviewer, focus on subject face, interviewer partially visible',
};

const SUBJECT_DEMOGRAPHIC_PROMPTS: Record<SubjectDemographic, string> = {
  any: 'Random everyday person, authentic street casting, diverse representation',
  young_professional: 'Young professional in their late 20s to mid 30s, career-focused appearance, confident posture',
  college_student: 'College-age student, youthful energy, casual student style, early 20s appearance',
  middle_aged: 'Middle-aged person, experienced presence, mature demeanor, 40s to 50s appearance',
  senior: 'Senior citizen, wise appearance, life experience visible, 60+ years old',
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
  casual: 'casual everyday clothing, comfortable and relaxed attire',
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
  nyc: 'New York City MTA subway aesthetic, white tile walls with colored trim, yellow platform edge safety line, classic NYC station signage, green globe lights at entrance',
  london: 'London Underground aesthetic, rounded tunnel walls, Mind the Gap platform warning, roundel logo visible, deep escalators, brown and cream tiles',
  tokyo: 'Tokyo Metro aesthetic, ultra-clean platforms, organized queuing lines on floor, digital screens, bright white lighting, orderly commuters',
  paris: 'Paris Metro aesthetic, Art Nouveau entrance style, dark green railings, vintage tilework, Metropolitain signage, narrow platforms',
  generic: 'Generic modern urban subway station, concrete pillars, fluorescent lighting, standard transit infrastructure',
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
  }
): string {
  const { speakerStyle, setting, cameraStyle, lightingMood, angle } = options;

  const speakerDesc = speakerStyle ? SPEAKER_STYLE_PROMPTS[speakerStyle] : SPEAKER_STYLE_PROMPTS.intense_coach;
  const settingDesc = setting ? SETTING_PROMPTS[setting] : SETTING_PROMPTS.gym;
  const cameraDesc = cameraStyle ? CAMERA_STYLE_PROMPTS[cameraStyle] : CAMERA_STYLE_PROMPTS.dramatic_push;
  const lightingDesc = lightingMood ? LIGHTING_PROMPTS[lightingMood] : LIGHTING_PROMPTS.dramatic_shadows;

  const basePrompt = `Vertical 9:16 motivational speaker video clip, ${duration} seconds.

Speaker: ${speakerDesc}
Topic: ${topic} - delivering powerful message about this theme.

Setting: ${settingDesc}
Camera: ${cameraDesc}
Lighting: ${lightingDesc}

Mood: determined, powerful, inspiring, relentless, viral-worthy intensity.
The speaker is mid-delivery of an impactful motivational speech moment.

No comedy, no parody, no text inside the video frame.
Single continuous shot. Capture the raw emotion and intensity.`;

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

  const basePrompt = `Realistic street interview clip, documentary style, ${duration} seconds.
Vertical 9:16 format. Handheld camera, authentic feel.

Location: ${sceneDesc}
Time: ${timeDesc}
Interview approach: ${styleDesc}

${characterDesc}

Topic: Candid interview moment about ${topic.toLowerCase()}.
${energyDesc}

Camera: Handheld mid-shot to close-up, shallow depth of field, slight natural shake.
Lighting: Natural available light appropriate for time of day.
Mood: authentic, spontaneous, real, candid, viral-worthy moment.

No text inside the video frame. Single continuous shot. Capture genuine human moment.`;

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

  const basePrompt = `Realistic viral subway interview clip, SubwayTakes documentary style, ${duration} seconds.
Vertical 9:16 format. Handheld camera, raw authentic feel.

Location: ${cityVisuals}
Scene: ${sceneSetting}
Interview approach: ${styleDesc}

${characterDesc}

Topic: ${questionContext}
${energyDesc}

Visual elements: Include subway ambience - train sounds, announcement echoes, commuters passing, platform activity.
Camera: Handheld documentary style, shallow depth of field, intimate framing, slight natural shake.
Lighting: Natural station lighting, harsh fluorescent mixed with warmer tones.
Mood: Urban, raw, authentic, spontaneous, real city life, viral-worthy moment.

No text inside the video frame. Single continuous shot. Capture genuine human moment.`;

  if (angle) {
    return `${basePrompt}\nSpecific creative direction: ${angle}`;
  }
  return basePrompt;
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
  };

  const options = hints[type];
  return options[Math.floor(Math.random() * options.length)];
}

export function createClipPlan(request: GenerateRequest): ClipPlan {
  const { videoType, topic, durationSeconds } = request;

  return {
    provider_prompt: buildProviderPrompt(request),
    negative_prompt: NEGATIVE_PROMPT,
    video_type: videoType,
    topic,
    duration_seconds: durationSeconds,
    aspect_ratio: '9:16',
    variation_hint: generateVariationHint(videoType),
  };
}

export function createVariationPrompt(originalPrompt: string): string {
  return `${originalPrompt}\nVariation: change camera angle, background elements, and micro-movements; keep style and mood consistent; keep it realistic.`;
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
  return `${basePrompt}\nBatch variation ${sequence}/${total}: ${variations[variationIndex]}`;
}
