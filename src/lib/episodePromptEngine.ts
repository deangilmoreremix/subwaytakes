import type {
  CharacterBible,
  EpisodeScript,
  ShotType,
  CityStyle,
  CameraDirection,
} from './types';
import { buildCharacterBibleBlock } from './characters';

const CITY_VISUAL_CUES: Record<CityStyle, string> = {
  nyc: 'New York City MTA subway aesthetic, white tile walls with colored trim, yellow platform edge safety line, classic NYC station signage, green globe lights at entrance',
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

${characterBible}

[SCENE]
Location: Subway platform. ${cityVisuals}
Atmosphere: Urban energy, commuters in background, platform sounds, train announcements
Lighting: Natural station lighting, harsh fluorescent mixed with warmer tones
Time: Midday rush

[CAMERA]
${camera}
Handheld documentary style, slight natural shake, intimate but captures both subjects
Start slightly wider, subtle push-in as question lands

[ACTION]
The HOST approaches the GUEST on the platform.
HOST makes eye contact, microphone extended.
HOST asks the hook question with genuine curiosity.
GUEST's initial reaction - slight surprise, then engagement.
${buildDialogueBlock('HOST', script.hook_question)}

[AUDIO]
Ambient subway sounds: distant train rumble, announcement echoes, footsteps
Dialogue clear and crisp above ambient
Natural city reverb

[MOOD]
Viral interview energy, authentic street documentary, SubwayTakes signature style
Capture the moment the question lands - the hook that stops scrolling

Vertical 9:16 format. Single continuous shot. No text overlays.`;
}

export function buildGuestAnswerPrompt(config: ShotPromptConfig): string {
  const { duration, cityStyle, host, guest, script } = config;
  const characterBible = buildCharacterBibleBlock(host, guest);
  const cityVisuals = CITY_VISUAL_CUES[cityStyle];
  const camera = CAMERA_DESCRIPTIONS['close-up'];

  return `${buildShotHeader('guest_answer', 2, duration)}

${characterBible}

[SCENE]
Location: Subway platform. ${cityVisuals}
Same location as previous shot, continuous scene
Background activity: commuters passing, platform life continues

[CAMERA]
${camera}
Focus entirely on GUEST's face and expression
Capture every micro-expression, the authenticity of the response
Shallow depth of field, host slightly visible as blur

[ACTION]
GUEST delivers their main answer with authentic energy
Natural gestures, real facial expressions
The quotable moment - this is the viral clip
GUEST's ${guest.energy_persona} personality shines through
${buildDialogueBlock('GUEST', script.guest_answer)}

[AUDIO]
GUEST's voice prominent, ${guest.voice_style}
Subway ambience subdued but present
Natural room tone

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

${characterBible}

[SCENE]
Location: Subway platform. ${cityVisuals}
Continuous from previous shot, energy building

[CAMERA]
${camera}
Capture the back-and-forth dynamic
Quick focus shifts between speakers
Conversational tennis match energy

[ACTION]
HOST reacts to the answer, asks follow-up
Quick exchange, natural conversation rhythm
GUEST responds to follow-up with even more conviction
${buildDialogueBlock('HOST', script.follow_up_question)}
${buildDialogueBlock('GUEST', script.follow_up_answer)}

[AUDIO]
Both voices clear, natural overlap and rhythm
Subway sounds punctuate the exchange
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

${characterBible}

[SCENE]
Location: Subway platform. ${cityVisuals}
Same scene, reaction moment

[CAMERA]
${camera}
Focus on HOST's genuine reaction
Capture the authentic response to what was just said
Quick cut energy

[ACTION]
HOST's genuine reaction to the guest's answer
Could be: surprise, amusement, disbelief, respect
Natural reaction, not performed
HOST might laugh, nod, or shake head
${buildDialogueBlock('HOST', script.reaction_line)}

[AUDIO]
HOST's reaction vocalization
Any laugh or exclamation authentic
Subway ambient continues

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
Location: Subway environment. ${cityVisuals}
Pure atmosphere shot - no dialogue, no subjects
Cinematic moment between interview segments

[CAMERA]
${camera}
Artistic composition, finds beauty in the mundane
Train doors closing, or platform emptying, or lights flickering
Cinematic movement - slow pan or subtle dolly

[ACTION]
NO PEOPLE SPEAKING
Environmental storytelling:
- Train arriving or departing
- Commuters in motion (silhouettes, anonymous)
- Station architecture details
- Light and shadow interplay
- The rhythm of the subway

[AUDIO]
Pure ambient soundscape
Train sounds, platform announcements, city rhythm
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

${characterBible}

[SCENE]
Location: Subway platform. ${cityVisuals}
Final moment, same location
Train might be arriving or departing in background

[CAMERA]
${camera}
Final framing, captures both for the sendoff
Might pull slightly wider to include environment
The iconic SubwayTakes ending frame

[ACTION]
HOST delivers the closing line - the punchline, the "That's a TAKE"
Both HOST and GUEST react to the conclusion
Natural ending energy - laugh, handshake, or just knowing nod
The moment that makes people hit follow
${buildDialogueBlock('HOST', script.close_punchline)}

[AUDIO]
HOST's close delivery prominent
Any natural laughter or reactions
Subway sounds swell slightly - train arriving perhaps
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
