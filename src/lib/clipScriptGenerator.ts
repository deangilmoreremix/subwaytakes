import type { ClipType } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface ClipScript {
  hook_question: string;
  guest_answer: string;
  follow_up_question: string;
  follow_up_answer: string;
  reaction_line: string;
  close_punchline: string;
  source: 'ai' | 'fallback';
}

export interface GenerateClipScriptOptions {
  topic: string;
  videoType: ClipType;
  question?: string;
  energyLevel?: string;
  interviewStyle?: string;
  sceneType?: string;
  neighborhood?: string;
  speakerStyle?: string;
  studioSetup?: string;
  studioLighting?: string;
  cameraStyle?: string;
  lightingMood?: string;
  durationSeconds?: number;
  wisdomTone?: string;
  wisdomFormat?: string;
  wisdomDemographic?: string;
  wisdomSetting?: string;
  targetAgeGroup?: string;
}

export async function generateClipScript(
  options: GenerateClipScriptOptions
): Promise<ClipScript> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-script`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: options.topic,
          video_type: options.videoType,
          question: options.question || undefined,
          energy_level: options.energyLevel || undefined,
          interview_style: options.interviewStyle || undefined,
          scene_type: options.sceneType || undefined,
          neighborhood: options.neighborhood || undefined,
          speaker_style: options.speakerStyle || undefined,
          studio_setup: options.studioSetup || undefined,
          studio_lighting: options.studioLighting || undefined,
          camera_style: options.cameraStyle || undefined,
          lighting_mood: options.lightingMood || undefined,
          duration_seconds: options.durationSeconds || undefined,
          tone: options.wisdomTone || undefined,
          format: options.wisdomFormat || undefined,
          demographic: options.wisdomDemographic || undefined,
          setting: options.wisdomSetting || undefined,
          target_age_group: options.targetAgeGroup || undefined,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Script generation failed');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return {
      hook_question: data.hook_question || '',
      guest_answer: data.guest_answer || '',
      follow_up_question: data.follow_up_question || '',
      follow_up_answer: data.follow_up_answer || '',
      reaction_line: data.reaction_line || '',
      close_punchline: data.close_punchline || '',
      source: data.source === 'ai' ? 'ai' : 'fallback',
    };
  } catch {
    clearTimeout(timeoutId);
    throw new Error('Failed to generate script. Try again or write your own.');
  }
}

export function scriptToSpeechText(script: ClipScript): string {
  const lines = [
    script.hook_question,
    script.guest_answer,
    script.follow_up_question,
    script.follow_up_answer,
    script.reaction_line,
    script.close_punchline,
  ].filter(Boolean);

  return lines.join('\n\n');
}

export function formatScriptPreview(script: ClipScript): string {
  const parts: string[] = [];
  if (script.hook_question) parts.push(`HOST: ${script.hook_question}`);
  if (script.guest_answer) parts.push(`GUEST: ${script.guest_answer}`);
  if (script.follow_up_question) parts.push(`HOST: ${script.follow_up_question}`);
  if (script.follow_up_answer) parts.push(`GUEST: ${script.follow_up_answer}`);
  if (script.reaction_line) parts.push(`HOST: ${script.reaction_line}`);
  if (script.close_punchline) parts.push(`CLOSE: ${script.close_punchline}`);
  return parts.join('\n');
}
