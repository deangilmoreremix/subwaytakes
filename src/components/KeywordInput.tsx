import { useState, useMemo } from 'react';
import { Sparkles, ArrowRight, X, TrendingUp, Zap, Plus, BookOpen, Zap as ZapIcon, Layers, Target, CheckCircle } from 'lucide-react';
import {
  analyzeKeyword,
  expandKeyword,
  getSuggestedKeywords,
  getAllPopularKeywords,
  KEYWORD_CATEGORIES,
  SENTIMENT_MODIFIERS,
  PLATFORM_TARGETS,
  PROMPT_TEMPLATES,
  VIRAL_PROMPT_PRESETS,
  generatePromptVariations,
  getPromptsByCategory,
  scoreAndOptimizePrompt,
  type KeywordAnalysis,
  type SentimentModifier,
  type PlatformTarget,
  type KeywordCategory
} from '../lib/keywordEngine';
import type { ClipType } from '../lib/types';

interface KeywordInputProps {
  onKeywordAnalyzed: (analysis: KeywordAnalysis) => void;
  disabled?: boolean;
  forceClipType?: ClipType | null; // Allow forcing a specific clip type
}

export function KeywordInput({ onKeywordAnalyzed, disabled, forceClipType }: KeywordInputProps) {
  const [keyword, setKeyword] = useState('');
  const [analysis, setAnalysis] = useState<KeywordAnalysis | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showVariations, setShowVariations] = useState(false);
  const [expandedKeywords, setExpandedKeywords] = useState<string[]>([]);
  const [selectedClipType, setSelectedClipType] = useState<ClipType | null>(forceClipType || null);
  const [promptVariations, setPromptVariations] = useState<{variation: string; angle: string; viralPotential: number}[]>([]);
  const [promptScore, setPromptScore] = useState<{score: number; grade: string; suggestions: {suggestion: string; priority: string}[]} | null>(null);
  
  // Advanced options
  const [selectedSentiment, setSelectedSentiment] = useState<SentimentModifier | undefined>();
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformTarget | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<KeywordCategory | undefined>();

  const suggestedKeywords = useMemo(() => getSuggestedKeywords(), []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (keyword.trim() && !disabled) {
      const result = analyzeKeyword(keyword, {
        sentiment: selectedSentiment,
        platform: selectedPlatform,
        category: selectedCategory,
      });
      
      // Override clip type if user selected one
      if (selectedClipType) {
        result.clipType = selectedClipType;
        // Adjust settings based on forced clip type
        if (selectedClipType === 'motivational') {
          result.speakerStyle = 'intense_coach';
          result.motivationalSetting = 'gym';
          result.cameraStyle = 'dramatic_push';
          result.lightingMood = 'dramatic_shadows';
          result.energyLevel = 'high_energy';
        } else if (selectedClipType === 'wisdom_interview') {
          result.wisdomTone = 'gentle';
          result.energyLevel = 'calm';
          result.characterPreset = 'wisdom_mentor';
        } else if (selectedClipType === 'subway_interview') {
          result.sceneType = 'platform_waiting';
          result.cityStyle = 'nyc';
          result.subwayLine = '1';
        } else if (selectedClipType === 'studio_interview') {
          result.characterPreset = 'podcast_pro';
          result.subjectDemographic = 'business_exec';
        }
      }
      
      setAnalysis(result);
      onKeywordAnalyzed(result);
    }
  };

  const handleKeywordClick = (kw: string) => {
    setKeyword(kw);
    const result = analyzeKeyword(kw, {
      sentiment: selectedSentiment,
      platform: selectedPlatform,
      category: selectedCategory,
    });
    setAnalysis(result);
    onKeywordAnalyzed(result);
    setShowSuggestions(false);
  };

  const handleExpandKeyword = () => {
    if (keyword.trim()) {
      const expanded = expandKeyword(keyword);
      setExpandedKeywords(expanded);
    }
  };

  const handleExpandedKeywordClick = (kw: string) => {
    setKeyword(kw);
    handleSubmit();
  };

  const handleGenerateVariations = () => {
    if (keyword.trim()) {
      const variations = generatePromptVariations(keyword, 5);
      setPromptVariations(variations.map(v => ({ variation: v.variation, angle: v.angle, viralPotential: v.viralPotential })));
      setShowVariations(true);
    }
  };

  const handleScorePrompt = () => {
    if (keyword.trim()) {
      const result = scoreAndOptimizePrompt(keyword, { targetPlatform: selectedPlatform });
      setPromptScore({
        score: result.score,
        grade: result.grade,
        suggestions: result.suggestions.map(s => ({ suggestion: s.suggestion, priority: s.priority }))
      });
    }
  };

  const handleSelectPreset = (preset: typeof VIRAL_PROMPT_PRESETS[0]) => {
    setKeyword(preset.prompt);
    handleSubmit();
    setShowPresets(false);
  };

  const handleSelectTemplate = (template: typeof PROMPT_TEMPLATES[0]) => {
    const filled = template.template.replace('{topic}', keyword || 'your topic');
    setKeyword(filled);
    handleSubmit();
    setShowTemplates(false);
  };

  const handleSelectLibraryPrompt = (prompt: string) => {
    setKeyword(prompt);
    handleSubmit();
    setShowLibrary(false);
  };

  const clearAll = () => {
    setKeyword('');
    setAnalysis(null);
    setSelectedSentiment(undefined);
    setSelectedPlatform(undefined);
    setSelectedCategory(undefined);
    setExpandedKeywords([]);
    setPromptVariations([]);
    setPromptScore(null);
  };

  const getClipTypeLabel = (type: ClipType): string => {
    const labels: Record<ClipType, string> = {
      street_interview: 'Street Interview',
      subway_interview: 'Subway Interview',
      studio_interview: 'Studio Interview',
      motivational: 'Motivational',
      wisdom_interview: 'Wisdom Interview',
    };
    return labels[type];
  };

  const getViralScoreColor = (score: number): string => {
    if (score >= 85) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 55) return 'text-orange-400';
    return 'text-red-400';
  };

  const getViralScoreBg = (score: number): string => {
    if (score >= 85) return 'bg-green-500/20';
    if (score >= 70) return 'bg-yellow-500/20';
    if (score >= 55) return 'bg-orange-500/20';
    return 'bg-red-500/20';
  };

  return (
    <div className="space-y-4">
      {/* Video Type Selector */}
      <div className="flex flex-wrap gap-2 mb-2">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide mr-2">
          📹 Video Type:
        </span>
        {['street_interview', 'subway_interview', 'studio_interview', 'motivational', 'wisdom_interview'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelectedClipType(selectedClipType === type ? null : type as ClipType)}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
              selectedClipType === type
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            {type === 'street_interview' ? '🎤 Street' : 
             type === 'subway_interview' ? '🚇 Subway' : 
             type === 'studio_interview' ? '🎙️ Studio' : 
             type === 'motivational' ? '💪 Motivational' : 
             '🧓 Wisdom'}
          </button>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-amber-500" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setAnalysis(null);
              if (e.target.value.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onFocus={() => {
              if (keyword.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            disabled={disabled}
            placeholder="Enter a keyword (e.g., dating, money, motivation)"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 py-4 pl-12 pr-36 text-lg text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            {keyword && (
              <button
                type="button"
                onClick={handleExpandKeyword}
                className="rounded-lg bg-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-600 transition-colors flex items-center gap-1"
                title="AI Expand Keyword"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`rounded-lg px-3 py-2 text-sm transition-colors flex items-center gap-1 ${
                showAdvanced ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              <Zap className="h-4 w-4" />
              AI
            </button>
            <button
              type="submit"
              disabled={!keyword.trim() || disabled}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Generate
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* AI Advanced Options Panel */}
        {showAdvanced && (
          <div className="absolute z-50 mt-2 w-full rounded-xl border border-amber-500/30 bg-zinc-800 p-4 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sentiment Modifier */}
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  🎭 Sentiment
                </label>
                <div className="flex flex-wrap gap-1">
                  {SENTIMENT_MODIFIERS.slice(0, 5).map((mod) => (
                    <button
                      key={mod.value}
                      type="button"
                      onClick={() => {
                        setSelectedSentiment(selectedSentiment === mod.value ? undefined : mod.value);
                      }}
                      className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                        selectedSentiment === mod.value
                          ? 'bg-amber-500 text-black'
                          : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      {mod.emoji} {mod.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Target */}
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  📱 Platform
                </label>
                <div className="flex flex-wrap gap-1">
                  {PLATFORM_TARGETS.map((platform) => (
                    <button
                      key={platform.value}
                      type="button"
                      onClick={() => {
                        setSelectedPlatform(selectedPlatform === platform.value ? undefined : platform.value);
                      }}
                      className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                        selectedPlatform === platform.value
                          ? 'bg-amber-500 text-black'
                          : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      {platform.emoji} {platform.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  📂 Category
                </label>
                <div className="flex flex-wrap gap-1">
                  {KEYWORD_CATEGORIES.slice(0, 4).map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(selectedCategory === cat.value ? undefined : cat.value);
                      }}
                      className={`rounded-lg px-2 py-1 text-xs transition-colors ${
                        selectedCategory === cat.value
                          ? 'bg-amber-500 text-black'
                          : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Filters */}
            {(selectedSentiment || selectedPlatform || selectedCategory) && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-700 pt-3">
                <span className="text-xs text-zinc-500">Active filters:</span>
                {selectedSentiment && (
                  <button
                    type="button"
                    onClick={() => setSelectedSentiment(undefined)}
                    className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-1 text-xs text-amber-400"
                  >
                    {SENTIMENT_MODIFIERS.find(s => s.value === selectedSentiment)?.emoji} {selectedSentiment}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {selectedPlatform && (
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform(undefined)}
                    className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-1 text-xs text-amber-400"
                  >
                    {PLATFORM_TARGETS.find(p => p.value === selectedPlatform)?.emoji} {selectedPlatform}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {selectedCategory && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(undefined)}
                    className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-1 text-xs text-amber-400"
                  >
                    {KEYWORD_CATEGORIES.find(c => c.value === selectedCategory)?.emoji} {selectedCategory}
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAll}
                  className="ml-auto text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && keyword.length > 0 && (
          <div className="absolute z-50 mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 p-4 shadow-xl max-h-80 overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Quick Picks</span>
              <button
                type="button"
                onClick={() => setShowSuggestions(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedKeywords.money.slice(0, 3).map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => handleKeywordClick(kw)}
                  className="rounded-lg bg-zinc-700/50 px-3 py-1.5 text-sm text-zinc-300 hover:bg-amber-500/20 hover:text-amber-400 transition-colors"
                >
                  💰 {kw}
                </button>
              ))}
              {suggestedKeywords.dating.slice(0, 3).map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => handleKeywordClick(kw)}
                  className="rounded-lg bg-zinc-700/50 px-3 py-1.5 text-sm text-zinc-300 hover:bg-pink-500/20 hover:text-pink-400 transition-colors"
                >
                  💕 {kw}
                </button>
              ))}
              {suggestedKeywords.motivational.slice(0, 3).map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => handleKeywordClick(kw)}
                  className="rounded-lg bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  🚀 {kw}
                </button>
              ))}
              {suggestedKeywords.wisdom.slice(0, 3).map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => handleKeywordClick(kw)}
                  className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  🧓 {kw}
                </button>
              ))}
            </div>

            {/* Popular Keywords */}
            <div className="mt-4 border-t border-zinc-700 pt-4">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide block mb-2">Popular</span>
              <div className="flex flex-wrap gap-2">
                {getAllPopularKeywords().slice(0, 10).map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => handleKeywordClick(kw)}
                    className="rounded-lg bg-zinc-700/30 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200 transition-colors"
                  >
                    {kw.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Feature Tabs Row */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => setShowTemplates(!showTemplates)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
            showTemplates ? 'bg-amber-500 text-black' : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Templates
        </button>
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
            showPresets ? 'bg-amber-500 text-black' : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600'
          }`}
        >
          <ZapIcon className="h-3.5 w-3.5" />
          Viral Presets
        </button>
        <button
          type="button"
          onClick={() => setShowLibrary(!showLibrary)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
            showLibrary ? 'bg-amber-500 text-black' : 'bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Prompt Library
        </button>
        <button
          type="button"
          onClick={handleGenerateVariations}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600 transition-colors"
        >
          <Target className="h-3.5 w-3.5" />
          Get Variations
        </button>
        <button
          type="button"
          onClick={handleScorePrompt}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600 transition-colors"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Score My Prompt
        </button>
      </div>

      {/* Feature Panels */}
      
      {/* Prompt Templates Panel */}
      {showTemplates && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-400">Prompt Templates</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {PROMPT_TEMPLATES.slice(0, 6).map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelectTemplate(template)}
                className="text-left rounded-lg bg-zinc-700/50 p-3 text-xs text-zinc-300 hover:bg-zinc-600 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-400">{template.template.split(' ')[0]}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    template.viralPotential === 'high' ? 'bg-green-500/20 text-green-400' :
                    template.viralPotential === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-zinc-500/20 text-zinc-400'
                  }`}>
                    {template.viralPotential}
                  </span>
                </div>
                <div className="text-zinc-400">{template.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Viral Presets Panel */}
      {showPresets && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <ZapIcon className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-orange-400">🔥 Viral Presets</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {VIRAL_PROMPT_PRESETS.slice(0, 6).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="text-left rounded-lg bg-zinc-700/50 p-3 text-xs text-zinc-300 hover:bg-zinc-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-orange-300">{preset.name}</span>
                  <span className="flex items-center gap-1 text-green-400">
                    <TrendingUp className="h-3 w-3" />
                    {preset.viralScore}
                  </span>
                </div>
                <div className="text-zinc-500 truncate">{preset.prompt.substring(0, 60)}...</div>
                <div className="flex gap-1 mt-2">
                  {preset.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 bg-zinc-600/50 rounded text-[10px] text-zinc-400">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Library Panel */}
      {showLibrary && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-400">📚 Prompt Library</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {['money', 'dating', 'wisdom', 'motivational', 'career'].map((catId) => {
              const category = KEYWORD_CATEGORIES.find(c => c.value === catId);
              const prompts = getPromptsByCategory(catId as KeywordCategory);
              if (!category || !prompts) return null;
              return (
                <div key={catId}>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{category.emoji}</span>
                    <span className="text-xs font-medium text-zinc-400">{category.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {prompts.prompts.slice(0, 4).map((prompt) => (
                      <button
                        key={prompt.id}
                        type="button"
                        onClick={() => handleSelectLibraryPrompt(prompt.prompt)}
                        className="px-2 py-1 bg-zinc-700/50 rounded text-[10px] text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200 transition-colors truncate max-w-[200px]"
                      >
                        {prompt.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prompt Variations Panel */}
      {showVariations && promptVariations.length > 0 && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-400">🎯 Prompt Variations</span>
          </div>
          <div className="space-y-2">
            {promptVariations.map((v, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => { setKeyword(v.variation); handleSubmit(); setShowVariations(false); }}
                className="w-full text-left rounded-lg bg-zinc-700/50 p-3 text-xs text-zinc-300 hover:bg-zinc-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-500">{v.angle}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    v.viralPotential >= 90 ? 'bg-green-500/20 text-green-400' :
                    v.viralPotential >= 80 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-zinc-500/20 text-zinc-400'
                  }`}>
                    {v.viralPotential}
                  </span>
                </div>
                <div className="text-zinc-200">{v.variation.substring(0, 80)}...</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Score Panel */}
      {promptScore && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-cyan-500" />
              <span className="text-sm font-medium text-cyan-400">📊 Prompt Score</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${
                promptScore.score >= 90 ? 'text-green-400' :
                promptScore.score >= 75 ? 'text-yellow-400' :
                promptScore.score >= 60 ? 'text-orange-400' :
                'text-red-400'
              }`}>
                {promptScore.score}
              </span>
              <span className="px-2 py-1 bg-cyan-500/20 rounded text-cyan-400 text-sm font-bold">
                {promptScore.grade}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            {promptScore.suggestions.slice(0, 3).map((s, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${
                  s.priority === 'high' ? 'bg-red-400' :
                  s.priority === 'medium' ? 'bg-yellow-400' :
                  'bg-zinc-400'
                }`} />
                {s.suggestion}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Expanded Keywords */}
      {expandedKeywords.length > 0 && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-purple-400">AI Suggested Keywords</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {expandedKeywords.map((kw, idx) => (
              <button
                key={idx}
                onClick={() => handleExpandedKeywordClick(kw)}
                className="rounded-lg bg-purple-500/20 px-3 py-1.5 text-sm text-purple-300 hover:bg-purple-500/30 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Preview with Viral Score */}
      {analysis && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-400">AI Auto-Configuration</span>
            </div>
            {analysis.viralScore && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getViralScoreBg(analysis.viralScore.score)}`}>
                <TrendingUp className={`h-4 w-4 ${getViralScoreColor(analysis.viralScore.score)}`} />
                <span className={`font-bold ${getViralScoreColor(analysis.viralScore.score)}`}>
                  {analysis.viralScore.score}/100
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-zinc-500">Content Type:</span>
              <span className="ml-2 font-medium text-zinc-200">{getClipTypeLabel(analysis.clipType)}</span>
            </div>
            <div>
              <span className="text-zinc-500">Topic:</span>
              <span className="ml-2 font-medium text-zinc-200">{analysis.topic}</span>
            </div>
            <div>
              <span className="text-zinc-500">Tone:</span>
              <span className="ml-2 font-medium text-zinc-200">{analysis.toneDescription}</span>
            </div>
            <div>
              <span className="text-zinc-500">Preset:</span>
              <span className="ml-2 font-medium text-zinc-200">{analysis.characterPreset.replace(/_/g, ' ')}</span>
            </div>
            {analysis.sentiment && (
              <div>
                <span className="text-zinc-500">Sentiment:</span>
                <span className="ml-2 font-medium text-zinc-200 capitalize">{analysis.sentiment}</span>
              </div>
            )}
            {analysis.platform && (
              <div>
                <span className="text-zinc-500">Platform:</span>
                <span className="ml-2 font-medium text-zinc-200 capitalize">{analysis.platform.replace(/_/g, ' ')}</span>
              </div>
            )}
          </div>

          {/* Viral Score Factors */}
          {analysis.viralScore && analysis.viralScore.factors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-500/20">
              <span className="text-xs text-zinc-500">Viral Factors:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {analysis.viralScore.factors.slice(0, 3).map((factor, idx) => (
                  <span
                    key={idx}
                    className={`text-xs px-2 py-1 rounded ${
                      factor.impact === 'high' 
                        ? 'bg-green-500/20 text-green-400' 
                        : factor.impact === 'medium'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-zinc-500/20 text-zinc-400'
                    }`}
                  >
                    {factor.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Direction */}
          <div className="mt-3 pt-3 border-t border-amber-500/20">
            <span className="text-xs text-zinc-500">AI Direction:</span>
            <p className="mt-1 text-sm text-zinc-300">{analysis.viralDirection}</p>
          </div>

          {/* Tips */}
          {analysis.viralScore && analysis.viralScore.tips.length > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-500/20">
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-amber-500" />
                <span className="text-xs text-zinc-500">Tips to increase viral potential:</span>
              </div>
              <ul className="mt-1 space-y-1">
                {analysis.viralScore.tips.map((tip, idx) => (
                  <li key={idx} className="text-xs text-zinc-400 flex items-start gap-1">
                    <span className="text-amber-500">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
