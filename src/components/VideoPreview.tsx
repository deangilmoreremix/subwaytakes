import { useState, useRef, useEffect } from 'react';
import type { RemotionEffectsConfig } from '../lib/types';

interface VideoPreviewProps {
  effects: RemotionEffectsConfig;
  clipType: string;
  onVideoLoaded?: (duration: number) => void;
}

export function VideoPreview({ effects, clipType, onVideoLoaded }: VideoPreviewProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      onVideoLoaded?.(videoRef.current.duration);
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(event.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(event.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Video Display Area */}
      <div className="relative aspect-[9/16] bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700">
        {!videoSrc ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragging ? 'bg-blue-500/20 border-2 border-blue-500' : 'hover:bg-zinc-800'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-6xl mb-4">🎬</div>
            <div className="text-white font-medium mb-2">Drop video here</div>
            <div className="text-zinc-400 text-sm">or click to upload</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <>
            {/* Video Element */}
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-cover"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              playsInline
            />

            {/* Overlay Effects */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Progress Bar */}
              {effects.graphics.progressBar && (
                <div className="absolute top-3 left-3 right-3">
                  <div className="h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Caption Preview */}
              {effects.captions.enabled && (
                <div
                  className={`absolute ${
                    effects.captions.position === 'top'
                      ? 'top-20'
                      : effects.captions.position === 'center'
                      ? 'top-1/2 -translate-y-1/2'
                      : 'bottom-24'
                  } left-4 right-4`}
                >
                  <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 text-center">
                    <span className="text-white text-sm">
                      {effects.captions.animation === 'typewriter' ? (
                        <>
                          Sample caption...<span className="animate-pulse">|</span>
                        </>
                      ) : effects.captions.animation === 'highlight' ? (
                        <>
                          The <span className="text-yellow-400 font-bold">KEY</span> to success
                        </>
                      ) : (
                        'Sample caption text here'
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Lower Third Preview */}
              {effects.lowerThird.enabled && effects.lowerThird.style !== 'none' && (
                <div className="absolute bottom-8 left-4 right-4">
                  <div
                    className={`flex items-center gap-3 ${
                      effects.lowerThird.style === 'minimal'
                        ? ''
                        : effects.lowerThird.style === 'modern'
                        ? 'bg-white/10 backdrop-blur-md rounded-lg p-2'
                        : effects.lowerThird.style === 'vintage'
                        ? 'bg-amber-900/80 rounded-lg px-3 py-1 border-l-4 border-yellow-500'
                        : 'bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg px-4 py-2'
                    }`}
                  >
                    {(effects.lowerThird.showName || effects.lowerThird.showRole) &&
                      effects.lowerThird.customName && (
                        <div className="text-white font-bold">
                          {effects.lowerThird.customName}
                        </div>
                      )}
                    {effects.lowerThird.customTitle && (
                      <div className="text-blue-200 text-sm">
                        {effects.lowerThird.customTitle}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sound Wave */}
              {effects.graphics.soundWave && isPlaying && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-1">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-blue-500 to-purple-500 rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 40 + 10}px`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Chapter Markers */}
              {effects.graphics.chapterMarkers && (
                <div className="absolute top-12 left-3 right-3 flex gap-2">
                  {[0.25, 0.5, 0.75].map((marker) => (
                    <div
                      key={marker}
                      className="flex-1 h-2 bg-zinc-700/50 rounded-full relative"
                    >
                      <div
                        className="absolute right-0 -top-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
                        style={{ left: `${marker * 100}%` }}
                      >
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Play/Pause Overlay */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors pointer-events-auto"
            >
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                {isPlaying ? (
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
            </button>
          </>
        )}
      </div>

      {/* Video Controls */}
      {videoSrc && (
        <div className="space-y-2">
          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
            />
            <span className="text-xs text-zinc-400">{formatTime(duration)}</span>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = Math.max(0, currentTime - 10);
                  }
                }}
                className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.5 3C17.15 3 21.08 6.03 22.47 10.22L20.1 11C19.05 7.81 16.04 5.5 12.5 5.5C10.54 5.5 8.77 6.22 7.38 7.38L10 10H3V3L5.6 5.6C7.45 4 9.85 3 12.5 3M10 12V22H8V14H6V12H10M18 14V20C18 21.11 17.11 22 16 22H15V14H18M13 12V22H11V14H13V12H11" />
                </svg>
              </button>

              <button
                onClick={togglePlay}
                className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = Math.min(duration, currentTime + 10);
                  }
                }}
                className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.5 3C6.85 3 2.92 6.03 1.53 10.22L3.9 11C4.95 7.81 7.96 5.5 11.5 5.5C13.46 5.5 15.23 6.22 16.62 7.38L14 10H21V3L18.4 5.6C16.55 4 14.15 3 11.5 3M10 12V22H8V14H6V12H10M18 14V20C18 21.11 17.11 22 16 22H15V14H18M13 12V22H11V14H13V12H11" />
                </svg>
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            {/* Upload New Video */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Upload new
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Effect Status */}
      <div className="flex flex-wrap gap-2">
        {effects.captions.enabled && (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1">
            💬 Captions
          </span>
        )}
        {effects.lowerThird.enabled && (
          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full flex items-center gap-1">
            🏷️ Lower Third
          </span>
        )}
        {effects.intro.enabled && (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
            🎬 Intro
          </span>
        )}
        {effects.outro.enabled && (
          <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full flex items-center gap-1">
            📍 Outro
          </span>
        )}
        {effects.graphics.progressBar && (
          <span className="px-2 py-1 bg-pink-500/20 text-pink-400 text-xs rounded-full flex items-center gap-1">
            📊 Progress Bar
          </span>
        )}
        {effects.graphics.soundWave && (
          <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full flex items-center gap-1">
            🎵 Sound Wave
          </span>
        )}
      </div>
    </div>
  );
}
