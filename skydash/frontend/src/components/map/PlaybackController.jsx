import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Play, Pause, Square, SkipBack, SkipForward } from 'lucide-react';
import { usePlaybackStore } from '../../stores/playbackStore';

const SPEEDS = [1, 2, 4, 8];

function formatTime(ms) {
  if (!ms) return '--:--:--';
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ControlBtn({ icon: Icon, label, onClick, active, size = 14 }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active ?? undefined}
      className={clsx(
        'w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150',
        active
          ? 'bg-indigo-500/20 text-indigo-400'
          : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]',
      )}
    >
      <Icon size={size} strokeWidth={1.5} />
    </button>
  );
}

export default function PlaybackController() {
  const {
    isPlaying, speed, currentTime, startTime, endTime,
    active, play, pause, stop, setSpeed, seek,
  } = usePlaybackStore();

  const progress = endTime > startTime
    ? ((currentTime - startTime) / (endTime - startTime)) * 100
    : 0;

  const elapsed = currentTime - startTime;
  const total = endTime - startTime;

  const handleSeek = useCallback((e) => {
    const pct = Number(e.target.value);
    const time = startTime + (pct / 100) * (endTime - startTime);
    seek(time);
  }, [startTime, endTime, seek]);

  const handleSkipBack = useCallback(() => {
    seek(currentTime - 10000);
  }, [currentTime, seek]);

  const handleSkipForward = useCallback(() => {
    seek(currentTime + 10000);
  }, [currentTime, seek]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
  }, [speed, setSpeed]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute bottom-3 left-3 right-14 z-30 pointer-events-auto"
        >
          <div className="bg-zinc-950/90 backdrop-blur-xl border border-white/[0.08] rounded-xl px-4 py-3 shadow-2xl">
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  isPlaying
                    ? 'bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                    : 'bg-zinc-600',
                )} />
                <span className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500">
                  PLAYBACK
                </span>
              </div>
              <span className="text-[9px] font-mono text-zinc-600 tracking-wider">
                {formatTime(startTime)} — {formatTime(endTime)}
              </span>
            </div>

            {/* Main controls row */}
            <div className="flex items-center gap-3">
              {/* Transport buttons */}
              <div className="flex items-center gap-1">
                <ControlBtn
                  icon={SkipBack}
                  label="Back 10s"
                  onClick={handleSkipBack}
                  size={12}
                />
                <ControlBtn
                  icon={isPlaying ? Pause : Play}
                  label={isPlaying ? 'Pause' : 'Play'}
                  onClick={handlePlayPause}
                  active={isPlaying}
                />
                <ControlBtn
                  icon={Square}
                  label="Stop"
                  onClick={stop}
                  size={12}
                />
                <ControlBtn
                  icon={SkipForward}
                  label="Forward 10s"
                  onClick={handleSkipForward}
                  size={12}
                />
              </div>

              {/* Current time */}
              <span className="text-[11px] font-mono tabular-nums text-cyan-400 min-w-[60px] text-center">
                {formatTime(currentTime)}
              </span>

              {/* Scrubber */}
              <div className="flex-1 relative h-6 flex items-center group">
                <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                    style={{ width: `${progress}%` }}
                    layout
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={progress}
                  onChange={handleSeek}
                  aria-label="Playback timeline"
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute w-3.5 h-3.5 rounded-full bg-indigo-400 border-2 border-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.6)] pointer-events-none transition-all duration-100 group-hover:scale-125"
                  style={{ left: `calc(${progress}% - 7px)` }}
                />
              </div>

              {/* Elapsed / Total */}
              <span className="text-[10px] font-mono tabular-nums text-zinc-500 min-w-[80px] text-right">
                {formatDuration(elapsed)} / {formatDuration(total)}
              </span>

              {/* Speed selector */}
              <button
                onClick={cycleSpeed}
                aria-label="Change playback speed"
                className={clsx(
                  'px-2 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider transition-all',
                  'border border-white/[0.06]',
                  speed > 1
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200',
                )}
              >
                {speed}x
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
