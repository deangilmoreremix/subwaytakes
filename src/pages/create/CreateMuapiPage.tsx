import { useMemo, useState } from 'react';
import { useClipCreation } from '../../hooks/useClipCreation';
import type { WizardStepDef } from '../../hooks/useClipCreation';
import { PageHeader, EffectsModal } from '../../components/create/CommonCreateSections';
import { CreationWizard } from '../../components/create/CreationWizard';
import { AdvancedSettingsDrawer } from '../../components/create/AdvancedSettingsDrawer';
import { GenerateStep } from '../../components/create/steps/GenerateStep';
import { SelectionSummary } from '../../components/create/SelectionSummary';
import type {
  MuapiBrainstormInput,
  MuapiPlan,
  MuapiStrategyOption,
  SubwaySceneType,
  CityStyle,
  EnergyLevel,
  InterviewStyle,
} from '../../lib/types';

const STEPS: WizardStepDef[] = [
  { label: 'Brainstorm' },
  { label: 'Plan' },
  { label: 'Scene Mapping' },
  { label: 'Generate' },
];

function buildStrategies(brainstorm: MuapiBrainstormInput): MuapiStrategyOption[] {
  const base = brainstorm.concept || 'Urban interview';
  return [
    {
      id: 'street_probe',
      label: 'Street Probe Hook',
      hook: `Open with a sharp hook about ${base}`,
      visualDirection: 'Cinematic handheld close-medium framing with practical lighting',
      pacing: 'Fast first 2 seconds then natural conversational cadence',
      rationale: 'Maximizes retention while keeping human authenticity',
    },
    {
      id: 'subway_confessional',
      label: 'Subway Confessional',
      hook: `Confessional question tied to ${base}`,
      visualDirection: 'Subway documentary two-shot, card-mic always visible',
      pacing: 'Measured and reaction-driven with realistic pauses',
      rationale: 'Highest realism and strongest SubwayTakes identity lock',
    },
    {
      id: 'debate_spark',
      label: 'Debate Spark',
      hook: `Challenge take that triggers debate around ${base}`,
      visualDirection: 'Tighter framing, dynamic commuter background, human micro-reactions',
      pacing: 'Punchy back-and-forth with clear emotional beats',
      rationale: 'Strong comment-bait while preserving documentary realism',
    },
  ];
}

function buildPlanSummary(strategy: MuapiStrategyOption, brainstorm: MuapiBrainstormInput): string {
  return [
    `Objective: ${brainstorm.objective}`,
    `Audience: ${brainstorm.audience}`,
    `Hook: ${strategy.hook}`,
    `Visual: ${strategy.visualDirection}`,
    `Pacing: ${strategy.pacing}`,
    `Constraints: ${brainstorm.constraints || 'Maintain cinematic realism and human behavior'}`,
    `Must include: ${brainstorm.mustInclude || 'Documentary authenticity, physically plausible lighting, natural body mechanics'}`,
    `Avoid: ${brainstorm.avoid || 'AI artifacts, waxy skin, floating hands, synthetic crowd clones'}`,
  ].join(' | ');
}

export function CreateMuapiPage() {
  const clip = useClipCreation('muapi', STEPS);

  const [brainstorm, setBrainstorm] = useState<MuapiBrainstormInput>({
    concept: clip.topic,
    objective: 'Create a cinematic human-realistic subway interview clip',
    audience: 'Short-form social viewers',
    constraints: 'Keep visual authenticity and mode lock',
    mustInclude: 'Transit realism, card mic visibility, authentic reactions',
    avoid: 'Uncanny faces, fake lighting, synthetic movement',
  });

  const strategies = useMemo(() => buildStrategies(brainstorm), [brainstorm]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(strategies[1]?.id || strategies[0]?.id || '');

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId) || strategies[0];

  const [sceneType, setSceneType] = useState<SubwaySceneType>('inside_train');
  const [cityStyle, setCityStyle] = useState<CityStyle>('nyc');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('conversational');
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyle>('man_on_street');

  const canGenerate = Boolean(brainstorm.concept.trim() && brainstorm.objective.trim() && selectedStrategy);

  function buildPlan(): MuapiPlan {
    const strategy = selectedStrategy || strategies[0];
    return {
      summary: buildPlanSummary(strategy, brainstorm),
      selectedStrategyId: strategy.id,
      strategies,
      realismPriority: 'cinematic_human',
    };
  }

  function handleGenerate() {
    if (!canGenerate) {
      return;
    }

    clip.generateClip({
      videoType: 'muapi',
      sceneType,
      cityStyle,
      energyLevel,
      interviewStyle,
      subwayLine: 'any',
      muapiBrainstorm: brainstorm,
      muapiPlan: buildPlan(),
      anglePrompt: buildPlanSummary(selectedStrategy, brainstorm),
    });
  }

  const summaryGroups = useMemo(() => [
    {
      label: 'Brainstorm',
      stepIndex: 0,
      items: [
        { label: 'Concept', value: brainstorm.concept || 'Unset' },
        { label: 'Objective', value: brainstorm.objective || 'Unset' },
      ],
    },
    {
      label: 'Plan',
      stepIndex: 1,
      items: [
        { label: 'Strategy', value: selectedStrategy?.label || 'Unset' },
        { label: 'Realism', value: 'Cinematic + Human' },
      ],
    },
    {
      label: 'Scene Mapping',
      stepIndex: 2,
      items: [
        { label: 'Scene', value: sceneType.replace(/_/g, ' ') },
        { label: 'City', value: cityStyle.toUpperCase() },
        { label: 'Energy', value: energyLevel.replace(/_/g, ' ') },
        { label: 'Style', value: interviewStyle.replace(/_/g, ' ') },
      ],
    },
  ], [brainstorm.concept, brainstorm.objective, selectedStrategy?.label, sceneType, cityStyle, energyLevel, interviewStyle]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Muapi Planner"
        description="Superpowers workflow: brainstorm, plan, and generate with strict cinematic human-realism quality gates."
        clip={clip}
      />

      <CreationWizard clip={clip} steps={STEPS} accentColor="sky" onGenerate={handleGenerate}>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">Brainstorm</h3>
          <Input label="Concept" value={brainstorm.concept} onChange={(value) => { setBrainstorm(prev => ({ ...prev, concept: value })); clip.setTopic(value || clip.topic); }} />
          <Input label="Objective" value={brainstorm.objective} onChange={(value) => setBrainstorm(prev => ({ ...prev, objective: value }))} />
          <Input label="Audience" value={brainstorm.audience} onChange={(value) => setBrainstorm(prev => ({ ...prev, audience: value }))} />
          <Input label="Constraints" value={brainstorm.constraints || ''} onChange={(value) => setBrainstorm(prev => ({ ...prev, constraints: value }))} />
          <Input label="Must Include" value={brainstorm.mustInclude || ''} onChange={(value) => setBrainstorm(prev => ({ ...prev, mustInclude: value }))} />
          <Input label="Avoid" value={brainstorm.avoid || ''} onChange={(value) => setBrainstorm(prev => ({ ...prev, avoid: value }))} />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">Plan Strategies</h3>
          {strategies.map((strategy) => (
            <button
              key={strategy.id}
              type="button"
              onClick={() => setSelectedStrategyId(strategy.id)}
              className={`w-full rounded-xl border p-4 text-left transition ${selectedStrategyId === strategy.id ? 'border-sky-500/60 bg-sky-500/10' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'}`}
            >
              <p className="text-sm font-semibold text-zinc-100">{strategy.label}</p>
              <p className="mt-1 text-xs text-zinc-400">{strategy.hook}</p>
              <p className="mt-1 text-xs text-zinc-500">{strategy.visualDirection}</p>
            </button>
          ))}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="text-xs text-zinc-500">Strict quality gate is enabled: mode lock, cinematic realism, and human realism must pass before generation.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300">Scene Mapping</h3>
          <Select
            label="Scene"
            value={sceneType}
            onChange={(value) => setSceneType(value as SubwaySceneType)}
            options={[
              ['platform_waiting', 'Platform Waiting'],
              ['inside_train', 'Inside Train'],
              ['train_arriving', 'Train Arriving'],
              ['rush_hour', 'Rush Hour'],
              ['late_night', 'Late Night'],
              ['walking_through', 'Walking Through'],
            ]}
          />
          <Select
            label="City Style"
            value={cityStyle}
            onChange={(value) => setCityStyle(value as CityStyle)}
            options={[
              ['nyc', 'NYC'],
              ['london', 'London'],
              ['tokyo', 'Tokyo'],
              ['paris', 'Paris'],
              ['generic', 'Generic'],
            ]}
          />
          <Select
            label="Energy"
            value={energyLevel}
            onChange={(value) => setEnergyLevel(value as EnergyLevel)}
            options={[
              ['calm', 'Calm'],
              ['conversational', 'Conversational'],
              ['high_energy', 'High Energy'],
              ['chaotic', 'Chaotic'],
            ]}
          />
          <Select
            label="Interview Style"
            value={interviewStyle}
            onChange={(value) => setInterviewStyle(value as InterviewStyle)}
            options={[
              ['man_on_street', 'Man On Street'],
              ['quick_fire', 'Quick Fire'],
              ['friendly_chat', 'Friendly Chat'],
              ['debate_challenge', 'Debate Challenge'],
              ['reaction_test', 'Reaction Test'],
            ]}
          />
        </div>

        <GenerateStep
          clip={clip}
          onGenerate={handleGenerate}
          showSpeechScript={true}
          summaryCard={<SelectionSummary groups={summaryGroups} onEditStep={clip.goToStep} clip={clip} />}
          scriptContext={{ interviewStyle, energyLevel, sceneType }}
        />
      </CreationWizard>

      {!canGenerate && (
        <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <p className="text-sm text-rose-300">Complete concept, objective, and strategy selection before generating.</p>
        </div>
      )}

      <AdvancedSettingsDrawer clip={clip} />
      <EffectsModal clip={clip} />
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </div>
  );
}
