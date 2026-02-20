import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, Train, Video, Heart, ArrowRight } from 'lucide-react';
import type { ClipType } from '../lib/types';

interface CreationMode {
  type: ClipType;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  borderColor: string;
  accentColor: string;
  route: string;
  tags: string[];
}

const CREATION_MODES: CreationMode[] = [
  {
    type: 'subway_interview',
    title: 'Subway Interview',
    subtitle: 'SubwayTakes viral style',
    description: 'Capture raw, authentic reactions in subway settings. Choose subway lines, scene types, and city styles for maximum engagement.',
    icon: <Train className="h-7 w-7" />,
    gradient: 'from-amber-500/20 to-orange-500/10',
    borderColor: 'border-amber-500/30 hover:border-amber-500/60',
    accentColor: 'text-amber-400',
    route: '/create/subway',
    tags: ['Viral', 'NYC', 'Authentic'],
  },
  {
    type: 'street_interview',
    title: 'Street Interview',
    subtitle: 'Sidewalk documentary style',
    description: 'Man-on-the-street interviews with neighborhood selection, crowd dynamics, and urban soundscapes.',
    icon: <Users className="h-7 w-7" />,
    gradient: 'from-emerald-500/20 to-teal-500/10',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
    accentColor: 'text-emerald-400',
    route: '/create/street',
    tags: ['Documentary', 'Vox Pop', 'Street'],
  },
  {
    type: 'motivational',
    title: 'Motivational',
    subtitle: 'Cinematic b-roll / kinetic vibe',
    description: 'Powerful motivational speaker clips with dramatic camera work, lighting moods, and transformation arcs.',
    icon: <Sparkles className="h-7 w-7" />,
    gradient: 'from-red-500/20 to-rose-500/10',
    borderColor: 'border-red-500/30 hover:border-red-500/60',
    accentColor: 'text-red-400',
    route: '/create/motivational',
    tags: ['Cinematic', 'Inspiring', 'High Energy'],
  },
  {
    type: 'wisdom_interview',
    title: 'Wisdom Interview',
    subtitle: '55+ life experience & advice',
    description: 'Heartfelt conversations with experienced voices. Choose wisdom tones, formats, and demographics for genuine storytelling.',
    icon: <Heart className="h-7 w-7" />,
    gradient: 'from-amber-500/20 to-yellow-500/10',
    borderColor: 'border-amber-500/30 hover:border-amber-500/60',
    accentColor: 'text-amber-400',
    route: '/create/wisdom',
    tags: ['Heartfelt', 'Life Lessons', '55+'],
  },
  {
    type: 'studio_interview',
    title: 'Studio Interview',
    subtitle: 'Professional studio setup',
    description: 'Polished studio interviews with configurable desk setups, three-point lighting, and professional guest formats.',
    icon: <Video className="h-7 w-7" />,
    gradient: 'from-sky-500/20 to-blue-500/10',
    borderColor: 'border-sky-500/30 hover:border-sky-500/60',
    accentColor: 'text-sky-400',
    route: '/create/studio',
    tags: ['Professional', 'Podcast', 'Polished'],
  },
];

export function CreateHubPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Create
        </h1>
        <p className="mt-2 text-base text-zinc-400">
          Choose a creation tool to get started. Each mode is optimized for different content styles.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {CREATION_MODES.map((mode) => (
          <button
            key={mode.type}
            onClick={() => navigate(mode.route)}
            className={`group relative flex flex-col rounded-2xl border bg-gradient-to-br ${mode.gradient} ${mode.borderColor} p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20`}
          >
            <div className={`mb-4 ${mode.accentColor}`}>
              {mode.icon}
            </div>

            <h3 className="text-lg font-semibold text-zinc-100">{mode.title}</h3>
            <p className="mt-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {mode.subtitle}
            </p>

            <p className="mt-3 text-sm text-zinc-400 leading-relaxed flex-1">
              {mode.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {mode.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-xs text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className={`mt-5 flex items-center gap-1.5 text-sm font-medium ${mode.accentColor} opacity-0 group-hover:opacity-100 transition-opacity`}>
              Start creating
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Not sure which tool to use?</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Each creation tool includes an AI Keyword Generator that automatically picks the best settings based on your topic.
              Start with any tool and the AI will guide you to the optimal configuration for viral content.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
