import type {
  CharacterBible,
  EpisodeScript,
  ShotType,
  CityStyle,
  CameraDirection,
} from './types';
import { buildCharacterBibleBlock } from './characters';

const SUBWAYTAKES_BRAND_RULES = `
SUBWAYTAKES BRAND IDENTITY (MANDATORY FOR ALL SHOTS):
- Interviewer (HOST) MUST wear dark sunglasses at all times. Never removed during filming.
- Interviewer holds a flat MetroCard/transit card AS the microphone. No traditional mics.
- Natural subway fluorescent lighting only. No studio lights, no ring lights, no filters.
- Warm color temperature from real subway fluorescents.
- Documentary-style handheld: authentic, not staged, real commuters in background.
- Real subway car interior with natural imperfections, movement, ambient noise.
`;

const CITY_VISUAL_CUES: Record<CityStyle, string> = {
  nyc: 'New York City MTA subway car interior: blue plastic seats, silver handrails, subway route map on wall, white tile station walls with colored trim, yellow platform edge safety line, classic NYC station signage',
  london: 'London Underground aesthetic, rounded tunnel walls, Mind the Gap platform warning, roundel logo visible, deep escalators, brown and cream tiles',
  tokyo: 'Tokyo Metro aesthetic, ultra-clean platforms, organized queuing lines on floor, digital screens, bright white lighting, orderly commuters',
  paris: 'Paris Metro aesthetic, Art Nouveau entrance style, dark green railings, vintage tilework, Metropolitain signage, narrow platforms',
  generic: 'Generic modern urban subway station, concrete pillars, fluorescent lighting, standard transit infrastructure',
};

const CAMERA_DESCRIPTIONS: Record<CameraDirection, string> = {
  'two-shot': 'Two-shot framing, both host and guest visible, conversational positioning, natural interaction distance',
  'close-up': 'Close-up shot, head and shoulders, intimate framing, expressive facial details, shallow depth of field',
  'medium': 'Medium shot, waist-up framing, natural body language visible, balanced composition',
  'wide': 'Wide establishing shot, full environment visible, subjects smaller in frame, cinematic scope',
  'over-shoulder': 'Over-the-shoulder shot, listener perspective, creates depth and connection',
};

interface ShotPromptConfig {
  shotType: ShotType;
  sequence: number;
  duration: number;
  cityStyle: CityStyle;
  host: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>;
  guest: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>;
  script: EpisodeScript;
}

function buildDialogueBlock(speaker: string | null, line: string | null): string {
  if (!speaker || !line) return '';
  return `
[DIALOGUE]
${speaker.toUpperCase()}: "${line}"
[END DIALOGUE]`;
}

function buildShotHeader(shotType: ShotType, sequence: number, duration: number): string {
  const shotLabels: Record<ShotType, string> = {
    cold_open: 'COLD OPEN - Hook Question',
    guest_answer: 'GUEST ANSWER - Main Response',
    follow_up: 'FOLLOW UP - Quick Exchange',
    reaction: 'REACTION - Host Response',
    b_roll: 'B-ROLL - Atmosphere',
    close: 'CLOSE - Punchline Moment',
  };

  return `=== SHOT ${sequence}/6: ${shotLabels[shotType]} ===
Duration: ${duration} seconds`;
}

export function buildColdOpenPrompt(config: ShotPromptConfig): string {
  const { duration, cityStyle, host, guest, script } = config;
  const characterBible = buildCharacterBibleBlock(host, guest);
  const cityVisuals = CITY_VISUAL_CUES[cityStyle];
  const camera = CAMERA_DESCRIPTIONS['two-shot'];

  return `${buildShotHeader('cold_open', 1, duration)}

${SUBWAYTAKES_BRAND_RULES}

${characterBible}

[SCENE]
Location: Inside NYC subway car. ${cityVisuals}
Atmosphere: Urban energy, commuters seated nearby, train in motion, subway map visible on wall
Lighting: Natural subway fluorescent lighting, warm yellow cast, no studio lights
Time: Midday

[CAMERA]
${camera}
Handheld documentary style, slight natural shake, intimate but captures both subjects
Start slightly wider, subtle push-in as question lands
HOST's sunglasses and MetroCard mic clearly visible in frame

[ACTION]
The HOST (wearing dark sunglasses) is seated next to the GUEST inside the subway car.
HOST holds a flat MetroCard extended toward GUEST like a microphone.
HOST asks the hook question with genuine curiosity and comedic warmth.
GUEST's initial reaction - slight surprise, then engagement.
${buildDialogueBlock('HOST', script.hook_question)}

[AUDIO]
Ambient subway sounds: train rumble, track noise, distant announcements, door chimes
Dialogue clear and crisp above ambient
Natural subway reverb

[MOOD]
Viral interview energy, authentic documentary, SubwayTakes signature style
Capture the moment the question lands - the hook that stops scrolling

Vertical 9:16 format. Single continuous shot. No text overlays.`;
}

export function buildGuestAnswerPrompt(config: ShotPromptConfig): string {
  const { duration, cityStyle, host, guest, script } = config;
  const characterBible = buildCharacterBibleBlock(host, guest);
  const cityVisuals = CITY_VISUAL_CUES[cityStyle];
  const camera = CAMERA_DESCRIPTIONS['close-up'];

  return `${buildShotHeader('guest_answer', 2, duration)}

${SUBWAYTAKES_BRAND_RULES}

${characterBible}

[SCENE]
Location: Inside subway car. ${cityVisuals}
Same subway car as previous shot, continuous scene
Background: other passengers, subway windows showing tunnel motion

[CAMERA]
${camera}
Focus entirely on GUEST's face and expression
Capture every micro-expression, the authenticity of the response
Shallow depth of field, HOST with sunglasses slightly visible as blur
MetroCard mic visible at edge of frame

[ACTION]
GUEST delivers their main answer with authentic energy
Natural gestures, real facial expressions
The quotable moment - this is the viral clip
GUEST's ${guest.energy_persona} personality shines through
${buildDialogueBlock('GUEST', script.guest_answer)}

[AUDIO]
GUEST's voice prominent, ${guest.voice_style}
Subway train rumble subdued but present
Natural subway car acoustics

[MOOD]
This is THE answer - the one people screenshot and share
Authentic, unfiltered, real human moment
Capture the truth in their eyes

Vertical 9:16 format. Single continuous shot. No text overlays.`;
}

export function buildFollowUpPrompt(config: ShotPromptConfig): string {
  const { duration, cityStyle, host, guest, script } = config;
  const characterBible = buildCharacterBibleBlock(host, guest);
  const cityVisuals = CITY_VISUAL_CUES[cityStyle];
  const camera = CAMERA_DESCRIPTIONS['two-shot'];

  return `${buildShotHeader('follow_up', 3, duration)}

${SUBWAYTAKES_BRAND_RULES}

${characterBible}

[SCENE]
Location: Inside subway car. ${cityVisuals}
Continuous from previous shot, energy building
Same seats, same car, conversation intensifying

[CAMERA]
${camera}
Capture the back-and-forth dynamic
Quick focus shifts between speakers
HOST's sunglasses and MetroCard mic visible between them
Conversational tennis match energy

[ACTION]
HOST (sunglasses on, MetroCard in hand) reacts to the answer, asks follow-up
Quick exchange, natural conversation rhythm
GUEST responds to follow-up with even more conviction
${buildDialogueBlock('HOST', script.follow_up_question)}
${buildDialogueBlock('GUEST', script.follow_up_answer)}

[AUDIO]
Both voices clear, natural overlap and rhythm
Train sounds punctuate the exchange
Energy rising in the audio

[MOOD]
The conversation gets interesting - this is where it escalates
Natural chemistry, authentic exchange
The follow-up that deepens the take

Vertical 9:16 format. Single continuous shot. No text overlays.`;
}

export function buildReactionPrompt(config: ShotPromptConfig): string {
  const { duration, cityStyle, host, guest, script } = config;
  const characterBible = buildCharacterBibleBlock(host, guest);
  const cityVisuals = CITY_VISUAL_CUES[cityStyle];
  const camera = CAMERA_DESCRIPTIONS['close-up'];

  return `${buildShotHeader('reaction', 4, duration)}

${SUBWAYTAKES_BRAND_RULES}

${characterBible}

[SCENE]
Location: Inside subway car. ${cityVisuals}
Same car, reaction moment

[CAMERA]
${camera}
Focus on HOST's genuine reaction, dark sunglasses reflecting light
Capture the authentic response to what was just said
Quick cut energy

[ACTION]
HOST (wearing dark sunglasses) reacts genuinely to the guest's answer
Could be: surprise, amusement, disbelief, respect
Natural reaction, not performed
HOST might laugh, nod, or shake head while holding the MetroCard
${buildDialogueBlock('HOST', script.reaction_line)}

[AUDIO]
HOST's reaction vocalization
Any laugh or exclamation authentic
Subway ambient continues, train rumble

[MOOD]
The relatable moment - viewer sees themselves in the host's reaction
This validates the take
Genuine human response to something real

Vertical 9:16 format. Single continuous shot. No text overlays.`;
}

export function buildBRollPrompt(config: ShotPromptConfig): string {
  const { duration, cityStyle } = config;
  const cityVisuals = CITY_VISUAL_CUES[cityStyle];
  const camera = CAMERA_DESCRIPTIONS['wide'];

  return `${buildShotHeader('b_roll', 5, duration)}

[SCENE]
Location: NYC subway environment. ${cityVisuals}
Pure atmosphere shot - no dialogue, no interview subjects
Cinematic moment between interview segments
Natural subway fluorescent lighting, warm tones

[CAMERA]
${camera}
Artistic composition, finds beauty in the mundane
Train car interior detail, or doors closing, or tunnel lights streaking past windows
Cinematic movement - slow pan or subtle dolly

[ACTION]
NO PEOPLE SPEAKING
Environmental storytelling:
- Subway car interior: seats, handrails, route map, windows
- Train in motion, tunnel lights streaking past
- Commuters in silhouette, anonymous
- Light and shadow from fluorescent fixtures
- The rhythm and rattle of the subway

[AUDIO]
Pure ambient soundscape
Train rumble, track clatter, door chimes, distant announcements
No dialogue, let the environment speak

[MOOD]
Cinematic breath between dialogue
The subway as character
Urban poetry, visual rest
Builds anticipation for the close

Vertical 9:16 format. Single continuous shot. No text overlays. NO DIALOGUE.`;
}

export function buildClosePrompt(config: ShotPromptConfig): string {
  const { duration, cityStyle, host, guest, script } = config;
  const characterBible = buildCharacterBibleBlock(host, guest);
  const cityVisuals = CITY_VISUAL_CUES[cityStyle];
  const camera = CAMERA_DESCRIPTIONS['two-shot'];

  return `${buildShotHeader('close', 6, duration)}

${SUBWAYTAKES_BRAND_RULES}

${characterBible}

[SCENE]
Location: Inside subway car. ${cityVisuals}
Final moment, same car
Train approaching next station or doors about to open

[CAMERA]
${camera}
Final framing, captures both HOST (sunglasses, MetroCard) and GUEST for the sendoff
Might pull slightly wider to include subway car environment
The iconic SubwayTakes ending frame - both laughing or reacting

[ACTION]
HOST (sunglasses on, MetroCard in hand) delivers the closing line - the punchline
Both HOST and GUEST react to the conclusion
Natural ending energy - laugh, fist bump, or just knowing nod
The moment that makes people hit follow
${buildDialogueBlock('HOST', script.close_punchline)}

[AUDIO]
HOST's close delivery prominent
Any natural laughter or reactions
Train sounds swell slightly - approaching station
Ending with energy

[MOOD]
The button on the whole piece
Memorable closer that brands the content
"That's a TAKE" energy
Leave them wanting more

Vertical 9:16 format. Single continuous shot. No text overlays.`;
}

export function buildShotPrompt(config: ShotPromptConfig): string {
  switch (config.shotType) {
    case 'cold_open':
      return buildColdOpenPrompt(config);
    case 'guest_answer':
      return buildGuestAnswerPrompt(config);
    case 'follow_up':
      return buildFollowUpPrompt(config);
    case 'reaction':
      return buildReactionPrompt(config);
    case 'b_roll':
      return buildBRollPrompt(config);
    case 'close':
      return buildClosePrompt(config);
  }
}

export function buildAllShotPrompts(
  cityStyle: CityStyle,
  host: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>,
  guest: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>,
  script: EpisodeScript
): { shotType: ShotType; sequence: number; duration: number; prompt: string; dialogue: string | null; speaker: string | null }[] {
  const shots: { shotType: ShotType; sequence: number; duration: number; dialogue: string | null; speaker: string | null }[] = [
    { shotType: 'cold_open', sequence: 1, duration: 6, dialogue: script.hook_question, speaker: 'host' },
    { shotType: 'guest_answer', sequence: 2, duration: 8, dialogue: script.guest_answer, speaker: 'guest' },
    { shotType: 'follow_up', sequence: 3, duration: 6, dialogue: `${script.follow_up_question} / ${script.follow_up_answer}`, speaker: 'host' },
    { shotType: 'reaction', sequence: 4, duration: 4, dialogue: script.reaction_line, speaker: 'host' },
    { shotType: 'b_roll', sequence: 5, duration: 4, dialogue: null, speaker: null },
    { shotType: 'close', sequence: 6, duration: 8, dialogue: script.close_punchline, speaker: 'host' },
  ];

  return shots.map(shot => ({
    ...shot,
    prompt: buildShotPrompt({
      shotType: shot.shotType,
      sequence: shot.sequence,
      duration: shot.duration,
      cityStyle,
      host,
      guest,
      script,
    }),
  }));
}
