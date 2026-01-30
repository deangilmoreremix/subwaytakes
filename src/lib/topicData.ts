import {
  Flame,
  DollarSign,
  Heart,
  Briefcase,
  User,
  Brain,
  Building2,
  Dumbbell,
  Cpu,
  Smartphone,
  UtensilsCrossed,
  Music,
  Trophy,
  Plane,
  Users,
  UserPlus,
  Rocket,
  HeartPulse,
  Clock,
  type LucideIcon,
} from 'lucide-react';

export interface TopicItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: TopicCategory;
  sampleQuestions: string[];
}

export type TopicCategory =
  | 'popular'
  | 'relationships'
  | 'lifestyle'
  | 'career'
  | 'culture';

export const TOPIC_CATEGORIES: { id: TopicCategory; label: string }[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'career', label: 'Work & Money' },
  { id: 'culture', label: 'Culture' },
];

export const TOPICS: TopicItem[] = [
  {
    id: 'hottakes',
    label: 'Hot Takes',
    description: 'Controversial opinions that spark debate',
    icon: Flame,
    category: 'popular',
    sampleQuestions: [
      "What's a hill you're willing to die on?",
      "What's an opinion that would get you canceled?",
      "What do most people get completely wrong?",
    ],
  },
  {
    id: 'money',
    label: 'Money & Success',
    description: 'Financial takes and hustle culture',
    icon: DollarSign,
    category: 'career',
    sampleQuestions: [
      "What's the biggest money mistake you've made?",
      "Is being rich worth sacrificing your 20s?",
      "What's something expensive that's actually worth it?",
    ],
  },
  {
    id: 'dating',
    label: 'Dating & Relationships',
    description: 'Love, dating apps, red flags',
    icon: Heart,
    category: 'relationships',
    sampleQuestions: [
      "What's an instant dealbreaker on a first date?",
      "Are dating apps ruining romance?",
      "What's the biggest red flag you've ignored?",
    ],
  },
  {
    id: 'career',
    label: 'Career',
    description: 'Work life, jobs, and ambition',
    icon: Briefcase,
    category: 'career',
    sampleQuestions: [
      "What's the worst career advice you've received?",
      "Is work-life balance a myth?",
      "What would you never do for a job?",
    ],
  },
  {
    id: 'personal',
    label: 'Personal & Self',
    description: 'Self-improvement and life lessons',
    icon: User,
    category: 'culture',
    sampleQuestions: [
      "What's something you changed your mind about?",
      "What advice would you give your younger self?",
      "What's a lesson you learned the hard way?",
    ],
  },
  {
    id: 'philosophy',
    label: 'Philosophy',
    description: 'Deep thoughts and life questions',
    icon: Brain,
    category: 'culture',
    sampleQuestions: [
      "What's the meaning of life in one sentence?",
      "Is free will real or are we all programmed?",
      "What would you do if you knew you couldn't fail?",
    ],
  },
  {
    id: 'nyc',
    label: 'NYC Life',
    description: 'New York specific experiences',
    icon: Building2,
    category: 'popular',
    sampleQuestions: [
      "What's overrated about living in NYC?",
      "What's something only New Yorkers understand?",
      "Would you raise kids in the city?",
    ],
  },
  {
    id: 'fitness',
    label: 'Fitness & Health',
    description: 'Gym culture, workouts, wellness',
    icon: Dumbbell,
    category: 'lifestyle',
    sampleQuestions: [
      "What's the most overrated fitness trend?",
      "Gym bros: misunderstood or annoying?",
      "What's your biggest gym pet peeve?",
    ],
  },
  {
    id: 'tech',
    label: 'Tech & AI',
    description: 'Technology hot takes, AI, apps',
    icon: Cpu,
    category: 'culture',
    sampleQuestions: [
      "Will AI take your job?",
      "What tech do you refuse to use?",
      "Are we too dependent on our phones?",
    ],
  },
  {
    id: 'socialmedia',
    label: 'Social Media',
    description: 'Influencers, screen time, online life',
    icon: Smartphone,
    category: 'culture',
    sampleQuestions: [
      "Is social media making us worse people?",
      "What's the most toxic platform?",
      "Would you let your kids have TikTok?",
    ],
  },
  {
    id: 'food',
    label: 'Food & Dining',
    description: 'Food takes, comfort food, eating habits',
    icon: UtensilsCrossed,
    category: 'lifestyle',
    sampleQuestions: [
      "What's an overrated food everyone loves?",
      "Pineapple on pizza: yes or no?",
      "What's your controversial food combo?",
    ],
  },
  {
    id: 'music',
    label: 'Music',
    description: 'Artists, concerts, music opinions',
    icon: Music,
    category: 'lifestyle',
    sampleQuestions: [
      "What artist is overrated?",
      "What song is your guilty pleasure?",
      "Live concerts or studio recordings?",
    ],
  },
  {
    id: 'sports',
    label: 'Sports',
    description: 'Athletic takes, fandom, competitions',
    icon: Trophy,
    category: 'lifestyle',
    sampleQuestions: [
      "What's the most overrated sport?",
      "Are sports fans too obsessed?",
      "What's the hardest sport to play?",
    ],
  },
  {
    id: 'travel',
    label: 'Travel',
    description: 'Destinations, flying, adventures',
    icon: Plane,
    category: 'lifestyle',
    sampleQuestions: [
      "What's the most overrated travel destination?",
      "Window or aisle seat?",
      "What's somewhere you'd never go back to?",
    ],
  },
  {
    id: 'family',
    label: 'Family',
    description: 'Parents, siblings, family dynamics',
    icon: Users,
    category: 'relationships',
    sampleQuestions: [
      "What's the worst family advice you've gotten?",
      "Are you obligated to love your family?",
      "What family tradition do you hate?",
    ],
  },
  {
    id: 'friendship',
    label: 'Friendship',
    description: 'Friend groups, loyalty, connections',
    icon: UserPlus,
    category: 'relationships',
    sampleQuestions: [
      "How many real friends do you have?",
      "Can men and women be just friends?",
      "What ends a friendship instantly?",
    ],
  },
  {
    id: 'hustle',
    label: 'Hustle & Business',
    description: 'Side hustles, entrepreneurship',
    icon: Rocket,
    category: 'career',
    sampleQuestions: [
      "Is hustle culture toxic?",
      "What's the worst side hustle advice?",
      "Would you quit your 9-5 for your passion?",
    ],
  },
  {
    id: 'mentalhealth',
    label: 'Mental Health',
    description: 'Therapy, stress, self-care',
    icon: HeartPulse,
    category: 'popular',
    sampleQuestions: [
      "Should everyone go to therapy?",
      "Is self-care overrated?",
      "What's something that saved your mental health?",
    ],
  },
  {
    id: 'generational',
    label: 'Generational',
    description: 'Gen Z vs Millennials, age gaps',
    icon: Clock,
    category: 'culture',
    sampleQuestions: [
      "What do boomers get right?",
      "Is Gen Z softer or smarter?",
      "What will future generations judge us for?",
    ],
  },
];

export function getTopicsByCategory(category: TopicCategory): TopicItem[] {
  if (category === 'popular') {
    return TOPICS.filter((t) => t.category === 'popular');
  }
  return TOPICS.filter((t) => t.category === category);
}

export function searchTopics(query: string): TopicItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return TOPICS;
  return TOPICS.filter(
    (t) =>
      t.label.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.sampleQuestions.some((sq) => sq.toLowerCase().includes(q))
  );
}
