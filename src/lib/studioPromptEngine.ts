import type { StudioSetup, StudioLighting } from './types';

const STUDIO_SETUP_PROMPTS: Record<StudioSetup, string> = {
  podcast_desk: 'Professional podcast studio with dual microphones on boom arms, acoustic panels on walls, large desk with laptops and notes visible. Host and guest sit across from each other, intimate conversation distance. Warm amber desk lamps, soundproof room feel.',
  living_room: 'Upscale living room set with mid-century modern furniture, tasteful bookshelf backdrop, plants and warm lighting. Two comfortable armchairs angled toward each other. Feels personal and relaxed, like visiting someone\'s home.',
  minimalist_stage: 'Clean minimalist studio stage with solid dark backdrop, single spotlight, no distractions. Subject centered in frame. Modern, clean, TED-talk energy. Focus entirely on the speaker.',
  late_night: 'Late-night talk show set with city skyline backdrop, curved desk, guest chair. Band area suggested in background. Vibrant, energetic, entertainment-forward atmosphere. Rich jewel-tone lighting.',
  roundtable: 'Roundtable discussion setup with 3-4 seats around a curved table. Multiple camera angles implied. News/analysis feel with neutral grey-blue backdrop and professional lighting. Panel discussion energy.',
  fireside: 'Intimate fireside chat setup. Two leather chairs beside a warm fireplace, low ambient lighting, bookshelves in background. Cozy, private, confessional atmosphere. Think Charlie Rose or masterclass vibe.',
  news_desk: 'Professional news studio with anchor desk, multiple screens in background showing graphics. Clean, authoritative, credible atmosphere. Blue-white color scheme, crisp professional lighting.',
  creative_loft: 'Industrial creative loft studio with exposed brick, Edison bulbs, vinyl records and art on walls. Two stools at a high table with whiskey glasses. Creative, authentic, podcast-meets-art-gallery vibe.',
};

const STUDIO_LIGHTING_PROMPTS: Record<StudioLighting, string> = {
  three_point: 'Classic three-point lighting setup: key light at 45 degrees, fill light softer on opposite side, back/rim light separating subject from background. Professional, flattering, industry-standard look.',
  dramatic_key: 'Single dramatic key light creating strong shadows on one side of the face. Moody, cinematic, editorial look. Background darker. Creates visual tension and authority.',
  soft_diffused: 'Soft diffused lighting from large softboxes or ring lights. Even, flattering illumination with minimal shadows. Beauty/fashion quality. Clean, modern, approachable look.',
  colored_accent: 'Neutral key light with colored accent lights in the background (warm amber, cool blue, or brand colors). Adds depth and visual interest. Contemporary, branded, social-media-forward aesthetic.',
  natural_window: 'Natural window light from one side creating soft, authentic illumination. Blinds or curtains filtering sunlight. Organic, documentary feel. Real, unproduced, trustworthy vibe.',
  cinematic: 'Cinematic lighting with motivated practical sources (desk lamp, window, screen glow). Shallow depth of field implied. Film-quality look with intentional color palette and mood.',
};

export function buildStudioInterviewPrompt(
  topic: string,
  durationSeconds: number,
  options: {
    question?: string;
    angle?: string;
    setup?: StudioSetup;
    lighting?: StudioLighting;
    interviewerType?: string;
    interviewerPosition?: string;
    subjectDemographic?: string;
    subjectGender?: string;
    subjectStyle?: string;
  }
): string {
  const setup = options.setup || 'podcast_desk';
  const lighting = options.lighting || 'three_point';

  const setupPrompt = STUDIO_SETUP_PROMPTS[setup];
  const lightingPrompt = STUDIO_LIGHTING_PROMPTS[lighting];

  const interviewerDesc = options.interviewerType
    ? `Interviewer: ${options.interviewerType.replace(/_/g, ' ')}, ${options.interviewerPosition?.replace(/_/g, ' ') || 'seated across'}.`
    : 'Interviewer: Professional, confident, well-dressed host seated at desk.';

  const subjectParts: string[] = [];
  if (options.subjectDemographic) subjectParts.push(options.subjectDemographic.replace(/_/g, ' '));
  if (options.subjectGender) subjectParts.push(options.subjectGender);
  if (options.subjectStyle) subjectParts.push(`wearing ${options.subjectStyle.replace(/_/g, ' ')}`);
  const subjectDesc = subjectParts.length > 0
    ? `Guest: ${subjectParts.join(', ')}.`
    : 'Guest: Professional, articulate, confident speaker with genuine expertise on the topic.';

  let prompt = `Vertical 9:16 studio interview video, ${durationSeconds} seconds, single continuous shot.

STUDIO ENVIRONMENT:
${setupPrompt}

LIGHTING:
${lightingPrompt}

PEOPLE:
${interviewerDesc}
${subjectDesc}

TOPIC: ${topic}
${options.question ? `INTERVIEW QUESTION: "${options.question}"` : ''}

SHOT COMPOSITION:
- Start with a two-shot establishing the studio environment
- Subtle camera movement: gentle push-in during key moments
- Cut-away style: if single shot, slow drift between speakers
- Both subjects visible, natural eye contact and gestures
- Professional framing with headroom and look-space

PERFORMANCE DIRECTION:
- Natural conversation rhythm, not scripted-feeling
- Genuine reactions: nodding, leaning in, thoughtful pauses
- Hand gestures when making points
- Real engagement between speakers
- Host actively listens, doesn't just wait to ask next question

AUDIO ATMOSPHERE:
- Clean studio audio quality
- Subtle room tone (not dead silence)
- No music during conversation
- Natural speech cadence with breath sounds

VISUAL QUALITY:
- Shallow depth of field on speaker when close
- Rich color grading appropriate to setup
- No text overlays inside video frame
- Professional broadcast quality

${options.angle ? `CREATIVE DIRECTION: ${options.angle}` : ''}`;

  return prompt;
}

export function getStudioSetupOptions(): { value: StudioSetup; label: string; description: string }[] {
  return [
    { value: 'podcast_desk', label: 'Podcast Desk', description: 'Professional podcast studio with dual mics' },
    { value: 'living_room', label: 'Living Room', description: 'Upscale living room with armchairs' },
    { value: 'minimalist_stage', label: 'Minimalist Stage', description: 'Clean stage with single spotlight' },
    { value: 'late_night', label: 'Late Night', description: 'Talk show set with city backdrop' },
    { value: 'roundtable', label: 'Roundtable', description: 'Panel discussion table setup' },
    { value: 'fireside', label: 'Fireside', description: 'Intimate chairs by fireplace' },
    { value: 'news_desk', label: 'News Desk', description: 'Professional news anchor studio' },
    { value: 'creative_loft', label: 'Creative Loft', description: 'Industrial loft with character' },
  ];
}

export function getStudioLightingOptions(): { value: StudioLighting; label: string; description: string }[] {
  return [
    { value: 'three_point', label: '3-Point', description: 'Classic professional setup' },
    { value: 'dramatic_key', label: 'Dramatic', description: 'Strong shadows, moody feel' },
    { value: 'soft_diffused', label: 'Soft', description: 'Even, flattering illumination' },
    { value: 'colored_accent', label: 'Accent', description: 'Colored background lights' },
    { value: 'natural_window', label: 'Natural', description: 'Window light, documentary feel' },
    { value: 'cinematic', label: 'Cinematic', description: 'Film-quality motivated light' },
  ];
}
