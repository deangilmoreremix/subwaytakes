/**
 * Topic definitions with curated questions for the wizard.
 */

export interface TopicOption {
  id: string;
  label: string;
  emoji: string;
  questions: string[];
}

export const TOPICS: TopicOption[] = [
  {
    id: "money",
    label: "Money",
    emoji: "💰",
    questions: [
      "What's a money mistake you made that others should avoid?",
      "What's the best financial advice you've ever received?",
      "What's something worth spending extra money on?",
      "What's a waste of money that everyone buys?",
      "What's an expensive lesson you learned?",
      "Would you rather be rich and unhappy or poor and happy?",
      "What's the hardest truth about money?",
    ],
  },
  {
    id: "relationships",
    label: "Relationships",
    emoji: "💕",
    questions: [
      "What's relationship advice you'd give to your younger self?",
      "What's a red flag you wish you noticed earlier?",
      "What's the best relationship advice you've ever received?",
      "Would you rather have a perfect partner or a perfect life?",
      "What's something couples should stop doing?",
      "What's the most important quality in a partner?",
    ],
  },
  {
    id: "life_lessons",
    label: "Life Lessons",
    emoji: "🌱",
    questions: [
      "What's a hard truth you had to learn?",
      "What's something you'd do differently if you could?",
      "What's advice you'd give to your 20-year-old self?",
      "What's something that changed your perspective?",
      "What's a mistake that made you stronger?",
      "What do you wish more people understood?",
    ],
  },
  {
    id: "career",
    label: "Career",
    emoji: "💼",
    questions: [
      "What's career advice you'd give?",
      "What's a job you could never do?",
      "What's the worst career advice you've ever received?",
      "Would you rather love your job or make lots of money?",
      "What's a skill everyone should learn?",
      "What's something you wish you'd known about your career?",
    ],
  },
  {
    id: "regrets",
    label: "Regrets",
    emoji: "😔",
    questions: [
      "What's a regret you have?",
      "What's something you wish you'd said no to?",
      "Would you rather undo one regret or prevent one future mistake?",
      "What's a risk you didn't take that you regret?",
      "What's something you're glad you failed at?",
    ],
  },
  {
    id: "happiness",
    label: "Happiness",
    emoji: "😊",
    questions: [
      "What makes you happy?",
      "What's something simple that brings joy?",
      "What's a happiness myth you'd debunk?",
      "Would you rather be always happy or always motivated?",
      "What's something that changed your happiness?",
    ],
  },
  {
    id: "trends",
    label: "Trends",
    emoji: "📈",
    questions: [
      "What's a trend you don't understand?",
      "What's a trend that should come back?",
      "Would you rather follow trends or set them?",
      "What's a viral trend you participated in?",
      "What's a trend that's overrated?",
    ],
  },
  {
    id: "hypotheticals",
    label: "Hypotheticals",
    emoji: "🤔",
    questions: [
      "Would you rather have one wish or work hard for everything?",
      "Would you rather know when you die or how you die?",
      "Would you rather be famous but lonely or unknown but surrounded by love?",
      "Would you rather have unlimited money or unlimited time?",
      "Would you rather go back to the past or visit the future?",
    ],
  },
];

export function getTopicById(id: string): TopicOption | undefined {
  return TOPICS.find((t) => t.id === id);
}

export function getTopicsForAgeGroup(_ageGroup: string): TopicOption[] {
  // Filter topics based on age group if needed
  // For now, return all topics
  return TOPICS;
}

/**
 * Spice modifiers for questions.
 */
export interface SpiceOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export const SPICE_OPTIONS: SpiceOption[] = [
  { id: "spicy", label: "Spicy", emoji: "🌶️", description: "Push for controversial takes" },
  { id: "gentle", label: "Gentle", emoji: "🌸", description: "Soft, supportive approach" },
  { id: "funny", label: "Funny", emoji: "😂", description: "Find the humor angle" },
  { id: "direct", label: "Direct", emoji: "🎯", description: "No beating around the bush" },
  { id: "serious", label: "Serious", emoji: "严肃", description: "Deep, meaningful answers" },
  { id: "controversial", label: "Controversial", emoji: "💣", description: "Touch the third rail" },
];

export function getSpiceById(id: string): SpiceOption | undefined {
  return SPICE_OPTIONS.find((s) => s.id === id);
}
