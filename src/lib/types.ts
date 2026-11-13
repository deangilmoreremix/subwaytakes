

export type CharacterRole = 'host' | 'guest';

export interface CharacterBible {
  id: string;
  user_id: string;
  name: string;
  role: CharacterRole;
  age_range: string;
  gender: string;
  ethnicity: string;
  clothing_style: string;
  hair_description: string;
  distinguishing_features: string | null;
  energy_persona: string;
  voice_style: string;
  is_default: boolean;
  created_at: string;
  /** Phase 3: portrait + speaking voice */
  portrait_url?: string | null;
  voice_provider?: 'elevenlabs' | 'minimax' | null;
  voice_id?: string | null;
  voice_speed?: number;
}
