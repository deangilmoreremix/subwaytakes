/** Languages offered for dubbing. Whether each voice model speaks each language well is unverified until a live run (see scripts/live-dub.ts). */
export interface DubLanguage {
  id: string;
  label: string;
  /** Languages written without spaces between words are budgeted in characters, not words. */
  unit: 'words' | 'chars';
}

export const DUB_LANGUAGES: DubLanguage[] = [
  { id: 'es', label: 'Spanish', unit: 'words' },
  { id: 'fr', label: 'French', unit: 'words' },
  { id: 'de', label: 'German', unit: 'words' },
  { id: 'pt', label: 'Portuguese', unit: 'words' },
  { id: 'it', label: 'Italian', unit: 'words' },
  { id: 'ja', label: 'Japanese', unit: 'chars' },
  { id: 'ko', label: 'Korean', unit: 'words' },
  { id: 'hi', label: 'Hindi', unit: 'words' },
  { id: 'ar', label: 'Arabic', unit: 'words' },
  { id: 'zh', label: 'Mandarin Chinese', unit: 'chars' },
];

export const MAX_DUB_LANGUAGES = 5;
export const DUB_MIN_SECONDS = 2;
export const DUB_MAX_SECONDS = 30;

export const languageOf = (id: string): DubLanguage | undefined => DUB_LANGUAGES.find(l => l.id === id);
