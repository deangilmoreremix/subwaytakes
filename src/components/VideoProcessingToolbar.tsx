import { useState } from 'react';
import { Film, Type, Scissors, FileVideo, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { convertVideo, addCaptions, trimVideo } from '../lib/ffmpeg';
import { clsx } from '../lib/format';

interface VideoProcessingToolbarProps {
  videoUrl: string;
  onProcessed?: (newUrl: string) => void;
}

type ProcessingState = 'idle' | 'processing' | 'done' | 'error';

export function VideoProcessingToolbar({ videoUrl, onProcessed }: VideoProcessingToolbarProps) {
  const [state, setState] = useState<ProcessingState>('idle');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [showTrimInput, setShowTrimInput] = useState(false);
  const [trimStart, setTrimStart] = useState('00:00:00');
  const [trimEnd, setTrimEnd] = useState('00:00:10');
  const [showFormatSelect, setShowFormatSelect] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'mp4' | 'webm' | 'mov'>('mp4');

  function resetUI() {
    setShowCaptionInput(false);
    setShowTrimInput(false);
    setShowFormatSelect(false);
    setCaptionText('');
  }

  async function handleConvert() {
    if (!showFormatSelect) {
      resetUI();
      setShowFormatSelect(true);
      return;
    }

    setState('processing');
    setActiveAction('convert');
    setErrorMsg(null);
    resetUI();

    try {
      const result = await convertVideo(videoUrl, selectedFormat, 'high');
      setState('done');
      onProcessed?.(result);
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Conversion failed');
    }
  }

  async function handleAddCaptions() {
    if (!showCaptionInput) {
      resetUI();
      setShowCaptionInput(true);
      return;
    }

    if (!captionText.trim()) return;

    setState('processing');
    setActiveAction('captions');
    setErrorMsg(null);
    resetUI();

    try {
      const result = await addCaptions(videoUrl, captionText, {
        fontSize: 42,
        fontColor: 'white',
        position: 'bottom',
      });
      setState('done');
      onProcessed?.(result);
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Caption burn-in failed');
    }
  }

  async function handleTrim() {
    if (!showTrimInput) {
      resetUI();
      setShowTrimInput(true);
      return;
    }

    setState('processing');
    setActiveAction('trim');
    setErrorMsg(null);
    resetUI();

    try {
      const result = await trimVideo(videoUrl, trimStart, trimEnd);
      setState('done');
      onProcessed?.(result);
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Trimming failed');
    }
  }

  const isProcessing = state === 'processing';

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Film className="h-4 w-4 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Post-Processing</span>
        {state === 'processing' && (
          <span className="flex items-center gap-1.5 ml-auto text-xs text-amber-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing...
          </span>
        )}
        {state === 'done' && (
          <span className="flex items-center gap-1.5 ml-auto text-xs text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Done
          </span>
        )}
        {state === 'error' && (
          <span className="flex items-center gap-1.5 ml-auto text-xs text-rose-400">
            <AlertCircle className="h-3 w-3" />
            {errorMsg || 'Failed'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleConvert}
          disabled={isProcessing}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition',
            isProcessing && activeAction === 'convert'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
            isProcessing && activeAction !== 'convert' && 'opacity-50 cursor-not-allowed'
          )}
        >
          <FileVideo className="h-3.5 w-3.5" />
          Convert Format
        </button>

        <button
          onClick={handleAddCaptions}
          disabled={isProcessing}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition',
            isProcessing && activeAction === 'captions'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
            isProcessing && activeAction !== 'captions' && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Type className="h-3.5 w-3.5" />
          Burn Captions
        </button>

        <button
          onClick={handleTrim}
          disabled={isProcessing}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition',
            isProcessing && activeAction === 'trim'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
            isProcessing && activeAction !== 'trim' && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Scissors className="h-3.5 w-3.5" />
          Trim
        </button>
      </div>

      {showFormatSelect && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value as 'mp4' | 'webm' | 'mov')}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-600"
          >
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
            <option value="mov">MOV</option>
          </select>
          <button
            onClick={handleConvert}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-400 transition"
          >
            Convert
          </button>
          <button
            onClick={resetUI}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Cancel
          </button>
        </div>
      )}

      {showCaptionInput && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={captionText}
            onChange={(e) => setCaptionText(e.target.value)}
            placeholder="Enter caption text..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
            onKeyDown={(e) => e.key === 'Enter' && handleAddCaptions()}
          />
          <button
            onClick={handleAddCaptions}
            disabled={!captionText.trim()}
            className={clsx(
              'rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition',
              captionText.trim() ? 'hover:bg-amber-400' : 'opacity-50 cursor-not-allowed'
            )}
          >
            Burn In
          </button>
          <button
            onClick={resetUI}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Cancel
          </button>
        </div>
      )}

      {showTrimInput && (
        <div className="flex items-center gap-2 pt-1">
          <label className="text-xs text-zinc-500">Start</label>
          <input
            type="text"
            value={trimStart}
            onChange={(e) => setTrimStart(e.target.value)}
            placeholder="00:00:00"
            className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-600"
          />
          <label className="text-xs text-zinc-500">End</label>
          <input
            type="text"
            value={trimEnd}
            onChange={(e) => setTrimEnd(e.target.value)}
            placeholder="00:00:10"
            className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-600"
          />
          <button
            onClick={handleTrim}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-400 transition"
          >
            Trim
          </button>
          <button
            onClick={resetUI}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
