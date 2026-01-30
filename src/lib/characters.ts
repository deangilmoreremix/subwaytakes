import { supabase } from './supabase';
import type { CharacterBible, CharacterRole, CityStyle } from './types';
import { generateUserId } from './format';

export const DEFAULT_HOST: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'> = {
  name: 'SubwayTakes Host',
  role: 'host',
  age_range: 'late-20s',
  gender: 'male',
  ethnicity: 'mixed-race',
  clothing_style: 'casual streetwear, dark hoodie, confident stance',
  hair_description: 'short fade, well-groomed',
  distinguishing_features: 'warm smile, expressive eyebrows, microphone in hand',
  energy_persona: 'confident, charismatic, quick-witted street interviewer',
  voice_style: 'energetic and engaging, slight NYC accent',
  is_default: true,
};

const GUEST_PRESETS = {
  young_professional: {
    age_range: 'mid-20s',
    clothing_style: 'business casual, blazer over tee, clean sneakers',
    hair_description: 'styled modern cut',
    energy_persona: 'ambitious, articulate, slightly nervous on camera',
    voice_style: 'thoughtful, measured responses',
  },
  creative_type: {
    age_range: 'early-30s',
    clothing_style: 'artistic layered outfit, unique accessories, statement piece',
    hair_description: 'distinctive style, possibly colored or textured',
    energy_persona: 'expressive, animated, passionate speaker',
    voice_style: 'enthusiastic, uses vivid language',
  },
  seasoned_new_yorker: {
    age_range: 'mid-40s',
    clothing_style: 'practical urban wear, weathered leather jacket',
    hair_description: 'natural, low-maintenance',
    energy_persona: 'no-nonsense, direct, seen-it-all attitude',
    voice_style: 'blunt, authentic NYC accent, street-smart',
  },
  college_student: {
    age_range: 'early-20s',
    clothing_style: 'casual hoodie, backpack visible, university gear',
    hair_description: 'youthful, trendy',
    energy_persona: 'eager, optimistic, sometimes uncertain',
    voice_style: 'youthful slang, genuine reactions',
  },
  tourist: {
    age_range: 'mid-30s',
    clothing_style: 'comfortable travel clothes, camera around neck',
    hair_description: 'neat, practical',
    energy_persona: 'curious, wide-eyed, excited to share opinions',
    voice_style: 'friendly, slight non-NYC accent',
  },
};

type GuestPreset = keyof typeof GUEST_PRESETS;

const GENDERS = ['male', 'female', 'non-binary'] as const;
const ETHNICITIES = [
  'Black',
  'White',
  'Latino/Hispanic',
  'East Asian',
  'South Asian',
  'Middle Eastern',
  'mixed-race',
] as const;

export function generateRandomGuest(): Omit<CharacterBible, 'id' | 'user_id' | 'created_at'> {
  const presetKeys = Object.keys(GUEST_PRESETS) as GuestPreset[];
  const preset = GUEST_PRESETS[presetKeys[Math.floor(Math.random() * presetKeys.length)]];
  const gender = GENDERS[Math.floor(Math.random() * GENDERS.length)];
  const ethnicity = ETHNICITIES[Math.floor(Math.random() * ETHNICITIES.length)];

  return {
    name: 'Random Guest',
    role: 'guest',
    age_range: preset.age_range,
    gender,
    ethnicity,
    clothing_style: preset.clothing_style,
    hair_description: preset.hair_description,
    distinguishing_features: null,
    energy_persona: preset.energy_persona,
    voice_style: preset.voice_style,
    is_default: false,
  };
}

export function buildCharacterPromptFragment(character: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>): string {
  const features = character.distinguishing_features
    ? `\nDistinguishing features: ${character.distinguishing_features}`
    : '';

  return `[CHARACTER: ${character.role.toUpperCase()}]
Name: ${character.name}
Appearance: ${character.gender}, ${character.ethnicity}, ${character.age_range}
Hair: ${character.hair_description}
Clothing: ${character.clothing_style}${features}
Personality: ${character.energy_persona}
Voice: ${character.voice_style}`;
}

export function buildCharacterBibleBlock(
  host: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>,
  guest: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>
): string {
  return `=== CHARACTER BIBLE ===
${buildCharacterPromptFragment(host)}

${buildCharacterPromptFragment(guest)}
=== END CHARACTER BIBLE ===`;
}

export async function getOrCreateDefaultHost(): Promise<CharacterBible> {
  const userId = generateUserId();

  const { data: existing } = await supabase
    .from('character_bibles')
    .select('*')
    .eq('user_id', userId)
    .eq('role', 'host')
    .eq('is_default', true)
    .maybeSingle();

  if (existing) {
    return existing as CharacterBible;
  }

  const { data, error } = await supabase
    .from('character_bibles')
    .insert({
      user_id: userId,
      ...DEFAULT_HOST,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CharacterBible;
}

export async function createCharacter(
  character: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>
): Promise<CharacterBible> {
  const userId = generateUserId();

  const { data, error } = await supabase
    .from('character_bibles')
    .insert({
      user_id: userId,
      ...character,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CharacterBible;
}

export async function listCharacters(role?: CharacterRole): Promise<CharacterBible[]> {
  const userId = generateUserId();

  let query = supabase
    .from('character_bibles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (role) {
    query = query.eq('role', role);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data || []) as CharacterBible[];
}

export async function getCharacterById(id: string): Promise<CharacterBible | null> {
  const { data, error } = await supabase
    .from('character_bibles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as CharacterBible | null;
}

export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await supabase
    .from('character_bibles')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
