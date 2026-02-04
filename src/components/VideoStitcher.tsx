import { useState, useCallback } from 'react';
import { FolderOpen, Film, Clock, ArrowRight, Plus, X, Save, Play, Scissors } from 'lucide-react';
import { clsx } from '../lib/format';
import type { Clip } from '../lib/types';

interface StitchClip {
  clipId: string;
  clip: Clip;
  startTime: number;
  endTime: number;
  order: number;
}

interface VideoStitcherProps {
  clips: Clip[];
  onSave: (stitchConfig: { clipIds: string[]; totalDuration: number }) => void;
  onCancel: () => void;
}

export function VideoStitcher({ clips, onSave, onCancel }: VideoStitcherProps) {
  const [selectedClips, setSelectedClips] = useState<StitchClip[]>([]);
  const [availableClips, setAvailableClips] = useState<Clip[]>(clips);
  const [isDragging, setIsDragging] = useState(false);

  const addClip = useCallback((clip: Clip) => {
    const newStitchClip: StitchClip = {
      clipId: clip.id,
      clip,
      startTime: 0,
      endTime: clip.duration_seconds || 30,
      order: selectedClips.length,
    };
    setSelectedClips([...selectedClips, newStitchClip]);
    setAvailableClips(availableClips.filter(c => c.id !== clip.id));
  }, [selectedClips, availableClips]);

  const removeClip = useCallback((clipId: string) => {
    const clipToRemove = selectedClips.find(c => c.clipId === clipId);
    if (clipToRemove) {
      setAvailableClips([...availableClips, clipToRemove.clip]);
      setSelectedClips(selectedClips.filter(c => c.clipId !== clipId).map((c, i) => ({ ...c, order: i })));
    }
  }, [selectedClips, availableClips]);

  const moveClip = useCallback((clipId: string, direction: 'up' | 'down') => {
    const index = selectedClips.findIndex(c => c.clipId === clipId);
    if (direction === 'up' && index > 0) {
      const newClips = [...selectedClips];
      [newClips[index - 1], newClips[index]] = [newClips[index], newClips[index - 1]];
      setSelectedClips(newClips.map((c, i) => ({ ...c, order: i })));
    } else if (direction === 'down' && index < selectedClips.length - 1) {
      const newClips = [...selectedClips];
      [newClips[index], newClips[index + 1]] = [newClips[index + 1], newClips[index]];
      setSelectedClips(newClips.map((c, i) => ({ ...c, order: i })));
    }
  }, [selectedClips]);

  const updateClipTime = useCallback((clipId: string, field: 'startTime' | 'endTime', value: number) => {
    setSelectedClips(selectedClips.map(c => 
      c.clipId === clipId ? { ...c, [field]: value } : c
    ));
  }, [selectedClips]);

  const totalDuration = selectedClips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Scissors className="h-5 w-5 text-emerald-400" />
            Stitch Clips Together
          </h3>
          <p className="text-sm text-zinc-500">Combine multiple clips into one video</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{totalDuration}s</div>
            <div className="text-xs text-zinc-500">Total Duration</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Clips */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Available Clips ({availableClips.length})
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {availableClips.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800">
                No clips available
              </div>
            ) : (
              availableClips.map((clip) => (
                <button
                  key={clip.id}
                  onClick={() => addClip(clip)}
                  className="w-full p-3 bg-zinc-800/50 border border-zinc-700 hover:border-emerald-500/50 rounded-xl transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{clip.topic}</div>
                      <div className="text-xs text-zinc-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {clip.duration_seconds || 30}s
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-emerald-400" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Clips */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Film className="h-4 w-4" />
            Timeline ({selectedClips.length} clips)
          </h4>
          <div className="space-y-2">
            {selectedClips.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed">
                <Film className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Click clips from the left to add them here</p>
              </div>
            ) : (
              selectedClips.map((stitchClip, index) => (
                <div
                  key={stitchClip.clipId}
                  className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-white truncate max-w-[150px]">
                        {stitchClip.clip.topic}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveClip(stitchClip.clipId, 'up')}
                        disabled={index === 0}
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveClip(stitchClip.clipId, 'down')}
                        disabled={index === selectedClips.length - 1}
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeClip(stitchClip.clipId)}
                        className="p-1 text-zinc-400 hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Time adjustment */}
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="range"
                      min="0"
                      max={stitchClip.clip.duration_seconds || 30}
                      value={stitchClip.startTime}
                      onChange={(e) => updateClipTime(stitchClip.clipId, 'startTime', Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-zinc-400">{stitchClip.startTime}s</span>
                    <ArrowRight className="h-3 w-3 text-zinc-500" />
                    <span className="text-zinc-400">{stitchClip.endTime}s</span>
                    <input
                      type="range"
                      min="0"
                      max={stitchClip.clip.duration_seconds || 30}
                      value={stitchClip.endTime}
                      onChange={(e) => updateClipTime(stitchClip.clipId, 'endTime', Number(e.target.value))}
                      className="flex-1"
                    />
                  </div>
                  <div className="text-center text-xs text-zinc-500">
                    Duration: {stitchClip.endTime - stitchClip.startTime}s
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({
            clipIds: selectedClips.map(c => c.clipId),
            totalDuration,
          })}
          disabled={selectedClips.length < 2}
          className={clsx(
            'flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all',
            selectedClips.length >= 2
              ? 'bg-emerald-500 text-white hover:bg-emerald-400'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          )}
        >
          <Save className="h-4 w-4" />
          Stitch & Save
        </button>
      </div>
    </div>
  );
}
