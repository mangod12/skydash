import { useState } from 'react';
import { clsx } from 'clsx';
import { Play, Pause, SkipForward, Rewind } from 'lucide-react';

const SPEEDS = [1, 2, 5, 10];

export default function TimelineSlider() {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(75); // 0-100
  const [speed, setSpeed] = useState(0);

  return (
    <div className="absolute bottom-14 left-3 right-14 z-20 pointer-events-auto">
      <div className="bg-zinc-900/85 backdrop-blur-md border border-white/[0.06] rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* Controls */}
          <div className="flex items-center gap-1">
            <button
              className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
              onClick={() => setPosition(Math.max(0, position - 10))}
              aria-label="Rewind timeline"
            >
              <Rewind size={12} />
            </button>
            <button
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? 'Pause timeline' : 'Play timeline'}
              aria-pressed={playing}
              className={clsx(
                'w-7 h-7 flex items-center justify-center rounded-lg transition-colors',
                playing
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white',
              )}
            >
              {playing ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <button
              className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
              onClick={() => setPosition(Math.min(100, position + 10))}
              aria-label="Advance timeline"
            >
              <SkipForward size={12} />
            </button>
          </div>

          {/* Time display */}
          <span className="text-[9px] font-mono tabular-nums text-zinc-500 w-14 text-center">
            -{Math.round((100 - position) * 0.6)}m
          </span>

          {/* Slider */}
          <div className="flex-1 relative h-6 flex items-center group">
            <div className="absolute inset-x-0 h-1 rounded-full bg-zinc-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-indigo-500/50 transition-all duration-100"
                style={{ width: `${position}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              aria-label="Operational timeline"
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            <div
              className="absolute w-3 h-3 rounded-full bg-indigo-400 border-2 border-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.5)] pointer-events-none transition-all duration-100"
              style={{ left: `calc(${position}% - 6px)` }}
            />
          </div>

          {/* Now label */}
          <span className="text-[9px] font-mono text-zinc-600">NOW</span>

          {/* Speed */}
          <button
            onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}
            aria-label="Change timeline speed"
            className="text-[9px] font-mono font-bold text-zinc-500 hover:text-zinc-300 w-8 text-center transition-colors"
          >
            {SPEEDS[speed]}x
          </button>
        </div>
      </div>
    </div>
  );
}
