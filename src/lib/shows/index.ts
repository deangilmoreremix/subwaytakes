/**
 * Shows: the same card-as-mic interview, with a different host question, tone, badge and on-screen graphic.
 * A show never changes the shot grammar (side by side, the city's transit card is the only microphone);
 * it changes what is asked, how it feels and how the title looks.
 */
import type { PlaceSpec } from '../places';
import type { PickedVerse } from '../bible/types';
import { BIBLE_IDEAS, BIBLE_SAMPLE, MOTIVATION_IDEAS, MOTIVATION_SAMPLE } from './packs';

export type ShowId =
  | 'hot_take' | 'happiness' | 'one_question' | 'reveal' | 'duel'
  | 'would_you_rather' | 'compliment' | 'rate_my' | 'red_flag' | 'confession' | 'bible' | 'motivation';

export type Tone = 'playful' | 'deadpan' | 'heated' | 'warm' | 'joyful' | 'grateful' | 'candid' | 'surprised' | 'reverent' | 'hopeful' | 'calm' | 'fired_up' | 'tough_love';

export const TONE_TEXT: Record<Tone, string> = {
  playful: 'playful and grinning',
  deadpan: 'deadpan and completely serious',
  heated: 'heated and passionate',
  warm: 'warm, smiling and sincere',
  joyful: 'joyful, laughing and lit up',
  grateful: 'grateful and a little emotional, smiling',
  candid: 'candid and a bit sheepish',
  surprised: 'surprised and thinking out loud',
  reverent: 'quiet, sincere and reverent, speaking softly',
  hopeful: 'hopeful and gently smiling',
  calm: 'calm, steady and reassuring',
  fired_up: 'fired up, intense and full of energy',
  tough_love: 'direct and no-nonsense, but caring',
};

export const TONE_LABEL: Record<Tone, string> = {
  playful: 'Playful', deadpan: 'Deadpan', heated: 'Heated', warm: 'Warm', joyful: 'Joyful', grateful: 'Grateful', candid: 'Candid', surprised: 'Surprised',
  reverent: 'Reverent', hopeful: 'Hopeful', calm: 'Calm', fired_up: 'Fired up', tough_love: 'Tough love',
};

/** How the on-screen graphic is drawn. */
export type TitleVariant = 'take' | 'number' | 'vs' | 'ab' | 'score' | 'verse';

export interface Show {
  id: ShowId;
  label: string;
  blurb: string;
  /** The on-screen headline is what the guest says (Hot Take, Motivation) rather than the host's question. */
  titleFromTake?: boolean;
  /** Does the host ask a question you can edit (vs the fixed "So what's ur take?")? */
  editableQuestion: boolean;
  /** Default host question. */
  question: string;
  /** Label for what the guest says. */
  answerLabel: string;
  tones: Tone[];
  defaultTone: Tone;
  variant: TitleVariant;
  badge: string;
  /** Badge colours. */
  badgeBg: string; badgeFg: string;
  /** Beat after the answer. */
  reaction: string;
  /** Two guests (Debate duel). */
  guests: 1 | 2;
  /** Place changes applied when the show is chosen. */
  place: Partial<PlaceSpec>;
  /** Starter ideas for the Ideas picker (questions or takes). */
  ideas: string[];
  /** Guard rail that goes into every prompt for this show. */
  guard?: string;
}

export const SHOWS: Show[] = [
  {
    id: 'hot_take', label: 'Hot Take', blurb: 'The guest defends a bold take.', editableQuestion: false,
    question: "So what's ur take?", answerLabel: 'The take', tones: ['playful', 'deadpan', 'heated'], defaultTone: 'playful',
    variant: 'take', titleFromTake: true, badge: 'HOT TAKE', badgeBg: '#ffd21f', badgeFg: '#111', reaction: 'The host reacts, laughing.', guests: 1, place: {},
    ideas: ['Pineapple belongs on pizza.', 'Leggings should not be pants.', 'Cereal is a soup.', 'Tipping has gone too far.', 'Working from home beats the office.'],
  },
  {
    id: 'happiness', label: 'Happiness', blurb: 'Warm, feel-good answers.', editableQuestion: true,
    question: 'What made you smile today?', answerLabel: 'Their answer', tones: ['warm', 'joyful', 'grateful'], defaultTone: 'warm',
    variant: 'take', badge: 'HAPPY MOMENT', badgeBg: '#ffb36b', badgeFg: '#3a1d00',
    reaction: 'The host beams and gives the guest a warm high-five.', guests: 1, place: { time: 'golden_hour', crowd: 'moderate', ambience: ['conversations'] },
    ideas: ['What made you smile today?', 'Who are you most grateful for right now?', 'What is a small win you are proud of this week?', 'What is your favourite memory from this year?', 'What is the kindest thing a stranger has done for you?', 'What is the best advice you ever got?'],
    guard: 'Keep it wholesome and uplifting. No minors, no medical or therapy claims, no real people.',
  },
  {
    id: 'one_question', label: 'One question', blurb: 'One provocative question, a real debate in the comments.', editableQuestion: true,
    question: 'Would you ever forgive a friend who lied to protect you?', answerLabel: 'Their answer', tones: ['playful', 'deadpan', 'heated', 'surprised'], defaultTone: 'surprised',
    variant: 'take', badge: 'ONE QUESTION', badgeBg: '#ffffff', badgeFg: '#111', reaction: 'The host raises an eyebrow and nods slowly.', guests: 1, place: {},
    ideas: ['Would you ever forgive a friend who lied to protect you?', 'Is it ever okay to read your partner\'s texts?', 'What is a hill you will die on?', 'What does everyone pretend to like?', 'What would you do with one free hour a day?'],
  },
  {
    id: 'reveal', label: 'Reveal', blurb: 'Salary, rent, age, height: a big number appears.', editableQuestion: true,
    question: 'How much do you pay in rent?', answerLabel: 'Their answer (include the number)', tones: ['candid', 'surprised', 'deadpan'], defaultTone: 'candid',
    variant: 'number', badge: 'THE REVEAL', badgeBg: '#34d399', badgeFg: '#052e1b', reaction: 'The host raises both eyebrows.', guests: 1,
    place: { mode: 'street', streetScene: 'busy_sidewalk', time: 'midday' },
    ideas: ['How much do you pay in rent?', 'How much do you make a year?', 'How old are you, honestly?', 'How tall are you?', 'How much did you spend on your last date?', 'How many hours did you sleep last night?'],
    guard: 'Guests are fictional AI-generated characters; the numbers are invented, not real people\'s finances.',
  },
  {
    id: 'duel', label: 'Debate duel', blurb: 'Two guests argue opposite sides. The host picks a winner.', editableQuestion: true,
    question: 'Pineapple on pizza: yes or no?', answerLabel: 'Guest A takes', tones: ['playful', 'heated', 'deadpan'], defaultTone: 'heated',
    variant: 'vs', badge: 'DUEL', badgeBg: '#f87171', badgeFg: '#2a0505', reaction: 'The host raises both hands and picks a winner.', guests: 2, place: {},
    ideas: ['Pineapple on pizza: yes or no?', 'Cats or dogs?', 'Is a hot dog a sandwich?', 'Early bird or night owl?', 'Is cereal a soup?'],
  },
  {
    id: 'would_you_rather', label: 'Would you rather', blurb: 'Two options, the guest picks.', editableQuestion: true,
    question: 'Would you rather never use your phone again or never see your friends again?', answerLabel: 'Their pick', tones: ['playful', 'surprised', 'heated'], defaultTone: 'playful',
    variant: 'ab', badge: 'WOULD YOU RATHER', badgeBg: '#a78bfa', badgeFg: '#1c0b4a', reaction: 'The host gasps, then laughs at the pick.', guests: 1, place: {},
    ideas: ['Would you rather never use your phone again or never see your friends again?', 'Would you rather always be ten minutes late or twenty minutes early?', 'Would you rather fly or be invisible?', 'Would you rather skip lunch or skip breakfast forever?'],
  },
  {
    id: 'compliment', label: 'Compliment', blurb: 'The host compliments a stranger and watches them light up.', editableQuestion: true,
    question: 'You have great energy. What is the nicest compliment you have ever gotten?', answerLabel: 'Their answer', tones: ['warm', 'joyful', 'grateful'], defaultTone: 'warm',
    variant: 'take', badge: 'COMPLIMENT', badgeBg: '#f9a8d4', badgeFg: '#4a0a2b', reaction: 'The host smiles and thanks them.', guests: 1, place: { time: 'golden_hour' },
    ideas: ['You have great energy. What is the nicest compliment you have ever gotten?', 'What is something you are secretly really good at?', 'What is a compliment you wish people gave you more?'],
    guard: 'Compliments are kind and about choices, energy or style. Nothing about bodies, health, age or identity.',
  },
  {
    id: 'rate_my', label: 'Rate my', blurb: 'The guest scores something out of ten.', editableQuestion: true,
    question: 'Rate my outfit out of ten.', answerLabel: 'Their rating (include the number)', tones: ['playful', 'deadpan', 'candid'], defaultTone: 'playful',
    variant: 'score', badge: 'RATE MY', badgeBg: '#fbbf24', badgeFg: '#3a2500', reaction: 'The host gasps and checks the score.', guests: 1, place: {},
    ideas: ['Rate my outfit out of ten.', 'Rate my coffee order out of ten.', 'Rate my playlist out of ten.', 'Rate this train out of ten.', 'Rate my first-date idea out of ten.'],
  },
  {
    id: 'red_flag', label: 'Red flag / green flag', blurb: 'The guest calls it: red flag or green flag?', editableQuestion: true,
    question: 'Red flag or green flag: texting back after three days?', answerLabel: 'Their call', tones: ['playful', 'heated', 'deadpan'], defaultTone: 'playful',
    variant: 'take', badge: 'RED FLAG?', badgeBg: '#ef4444', badgeFg: '#ffffff', reaction: 'The host holds up a flag-shaped hand sign and laughs.', guests: 1, place: {},
    ideas: ['Red flag or green flag: texting back after three days?', 'Red flag or green flag: still being friends with an ex?', 'Red flag or green flag: always being early?', 'Red flag or green flag: never watching TV?'],
  },
  {
    id: 'confession', label: 'Confessions', blurb: 'A funny, harmless confession.', editableQuestion: true,
    question: 'What is the dumbest thing you have ever spent money on?', answerLabel: 'Their confession', tones: ['candid', 'playful', 'surprised'], defaultTone: 'candid',
    variant: 'take', badge: 'CONFESSION', badgeBg: '#c084fc', badgeFg: '#2a0a4a', reaction: 'The host covers their mouth and laughs.', guests: 1, place: {},
    ideas: ['What is the dumbest thing you have ever spent money on?', 'What is your most embarrassing train moment?', 'What is something you pretend to understand?', 'What is a guilty pleasure you will never give up?'],
    guard: 'Funny and harmless only. Nothing illegal, violent, sexual or about real people.',
  },
  {
    id: 'bible', label: 'Scripture', blurb: 'The guest shares a Bible verse and what it means to them. The verse appears on screen word for word.', editableQuestion: true,
    question: 'What verse got you through this week?', answerLabel: 'Their reflection', tones: ['reverent', 'hopeful', 'grateful', 'calm', 'joyful'], defaultTone: 'reverent',
    variant: 'verse', badge: 'SCRIPTURE', badgeBg: '#e9dcb0', badgeFg: '#2b1d00', reaction: 'The host listens quietly, then gives a warm, gentle nod and a small smile.', guests: 1,
    place: { time: 'golden_hour', crowd: 'sparse', ambience: ['conversations'] },
    ideas: BIBLE_IDEAS,
    guard: 'Two ordinary commuters talking quietly. No religious figures, symbols, scenes, halos, crosses or imagery appear. Nothing is promised about healing, wealth or outcomes.',
  },
  {
    id: 'motivation', label: 'Motivation', blurb: 'Advice and mindset in the guest\'s own words, on a bold quote card.', editableQuestion: true,
    question: 'What got you through your hardest day?', answerLabel: 'Their advice', tones: ['fired_up', 'calm', 'tough_love', 'grateful'], defaultTone: 'fired_up',
    variant: 'take', titleFromTake: true, badge: 'MOTIVATION', badgeBg: '#ff5a1f', badgeFg: '#ffffff', reaction: 'The host nods, clearly fired up, and gives the guest a fist bump.', guests: 1,
    place: { time: 'early_morning', crowd: 'moderate' },
    ideas: MOTIVATION_IDEAS,
    guard: 'Original advice in the guest\'s own words. Never attribute a quote to anyone by name. No medical claims and no promises about outcomes or money.',
  },
];

export const DEFAULT_SHOW: ShowId = 'hot_take';

export function showOf(id: ShowId | undefined): Show {
  return SHOWS.find(s => s.id === id) ?? SHOWS[0];
}

/** The host's spoken question for a show (the fixed opener for Hot Take). */
export function questionFor(show: Show, question: string | undefined): string {
  if (!show.editableQuestion) return show.question;
  return question?.trim() || show.question;
}

// ---- on-screen graphic data, derived from what was said -------------------------------------------------

/** First number in the answer, kept with a currency symbol or unit if it has one ("$1,800", "6'2", "27"). */
export function extractNumber(text: string): string | null {
  const m = text.match(/([$£€]\s?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM])?)|(\d+'\s?\d{1,2}"?)|(\d[\d,]*(?:\.\d+)?(?:\s?[kKmM])?)/);
  return m ? m[0].replace(/\s+/g, '') : null;
}

/** Score out of ten from an answer such as "7 out of 10", "a solid 8" or "9/10". Clamped to 0 to 10. */
export function extractScore(text: string): string | null {
  const m = text.match(/(\d+(?:\.\d)?)\s*(?:\/|out of)\s*10/i) ?? text.match(/\b(\d+(?:\.\d)?)\b/);
  if (!m) return null;
  const n = Math.min(10, Math.max(0, Number(m[1])));
  return Number.isFinite(n) ? `${n % 1 ? n.toFixed(1) : n}/10` : null;
}

/** "Would you rather X or Y?" into its two options (null if it cannot be split). */
export function splitOptions(question: string): [string, string] | null {
  const body = question.replace(/^would you rather\s+/i, '').replace(/[?.!\s]+$/g, '');
  const parts = body.split(/\s+or\s+/i);
  if (parts.length < 2) return null;
  const a = parts[0].trim(), b = parts.slice(1).join(' or ').trim();
  return a && b ? [a, b] : null;
}

/** Verse text gets smaller as it gets longer so up to about 300 characters stay inside the card (pure, so it is tested). */
export function verseFontSize(text: string): number { const n = text.length; return n <= 70 ? 66 : n <= 130 ? 56 : n <= 200 ? 48 : n <= 260 ? 42 : 36; }

export interface TitleData {
  variant: TitleVariant;
  badge: string; badgeBg: string; badgeFg: string;
  /** Main text (the take, the question or the VS headline). */
  headline: string;
  /** vs: the two sides. ab: the two options. */
  left?: string; right?: string;
  /** number / score: the big value. */
  value?: string;
}

export interface TitleInput {
  show?: ShowId; question?: string; take: string; take2?: string; verse?: PickedVerse;
}

/** Everything the on-screen graphic needs, from the spec. Pure. */
export function titleFor(t: TitleInput): TitleData {
  const show = showOf(t.show);
  const base = { variant: show.variant, badge: show.badge, badgeBg: show.badgeBg, badgeFg: show.badgeFg };
  const question = questionFor(show, t.question);
  switch (show.variant) {
    case 'number': return { ...base, headline: question, value: extractNumber(t.take) ?? undefined };
    case 'score': return { ...base, headline: question, value: extractScore(t.take) ?? undefined };
    case 'verse': return t.verse?.text ? { ...base, headline: t.verse.text, value: `${t.verse.ref} · ${t.verse.translation === 'custom' ? 'your text' : t.verse.translation}` } : { ...base, headline: question };
    case 'ab': {
      const ab = splitOptions(question);
      return { ...base, headline: 'Would you rather', left: ab?.[0], right: ab?.[1] };
    }
    case 'vs': return { ...base, headline: question, left: t.take.trim(), right: (t.take2 ?? '').trim() };
    default:
      // Hot Take puts the take on screen; the other shows put the question there.
      return { ...base, headline: show.titleFromTake ? t.take : question };
  }
}

// ---- switching shows ---------------------------------------------------------------------------------------

/** Placeholder answers so a freshly chosen show makes sense (replaced as soon as the user types). Index 1 is guest B. */
export const SAMPLE_ANSWERS: Record<ShowId, string[]> = {
  hot_take: ['Pineapple belongs on pizza and anyone who disagrees is scared of joy.'],
  happiness: ['A stranger held the door and told me to have a great day, and it honestly made my whole morning.'],
  one_question: ['Honestly, yes. If they did it to protect me, I would forgive them after a long talk.'],
  reveal: ['I pay $2,400 a month and my place is the size of a closet.'],
  duel: ['Yes, pineapple belongs on pizza. Sweet and salty is the best combo.', 'No way. Fruit on pizza is a crime and I will not be taking questions.'],
  would_you_rather: ['I would give up my phone, because my friends are the whole point.'],
  compliment: ['Someone once told me I make every room feel calmer, and I think about that all the time.'],
  rate_my: ['That is a solid 7 out of 10. The jacket is great but the shoes are fighting it.'],
  red_flag: ['Red flag. Three days is a lifetime. Just text back.'],
  confession: ['I bought a stand mixer and have used it exactly once, to make one single cookie.'],
  bible: [BIBLE_SAMPLE],
  motivation: [MOTIVATION_SAMPLE],
};

const ALL_SAMPLES = new Set(Object.values(SAMPLE_ANSWERS).flat());

interface ShowSwitchable { show: ShowId; question?: string; tone: Tone; place: PlaceSpec; take: string; take2?: string; verse?: PickedVerse; reflection?: string }

/** Switch show: its question, an allowed tone, place defaults, and a matching sample answer if the user has not written one. Pure. */
export function applyShow<T extends ShowSwitchable>(spec: T, id: ShowId): T {
  const show = showOf(id);
  const samples = SAMPLE_ANSWERS[id];
  const untouched = (v: string | undefined) => !v?.trim() || ALL_SAMPLES.has(v);
  // Scripture keeps its own reflection and verse, and `take` for that show is COMPOSED from them (the spoken line). So leaving Scripture must not
  // carry the composed line along as if the customer had typed it, and coming back must not resurrect an old reflection over newer typing.
  if (spec.show === 'bible' && id !== 'bible') {
    return { ...spec, show: id, verse: undefined, reflection: undefined, question: show.editableQuestion ? show.question : undefined, tone: show.tones.includes(spec.tone) ? spec.tone : show.defaultTone,
      place: { ...spec.place, ...show.place }, take: samples[0], take2: show.guests === 2 ? samples[1] : spec.take2 };
  }
  if (id === 'bible' && spec.show !== 'bible') {
    return { ...spec, show: id, verse: undefined, reflection: untouched(spec.take) ? BIBLE_SAMPLE : spec.take, question: show.question, tone: show.tones.includes(spec.tone) ? spec.tone : show.defaultTone,
      place: { ...spec.place, ...show.place }, take: spec.take, take2: spec.take2 };
  }
  return {
    ...spec,
    show: id,
    question: show.editableQuestion ? show.question : undefined,
    tone: show.tones.includes(spec.tone) ? spec.tone : show.defaultTone,
    place: { ...spec.place, ...show.place },
    take: untouched(spec.take) ? samples[0] : spec.take,
    take2: show.guests === 2 ? (untouched(spec.take2) ? samples[1] : spec.take2) : spec.take2,
  };
}
