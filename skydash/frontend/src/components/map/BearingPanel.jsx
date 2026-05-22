import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Navigation } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import {
  calculateBearing,
  calculateDistance,
  magneticDeclination,
  estimateTravelTime,
  formatBearing,
  formatDistance,
} from '../../utils/bearing';

const UNITS = ['km', 'nm', 'mi'];
const SPEEDS = [60, 120, 200, 400, 800]; // kph presets

export default function BearingPanel({ active }) {
  const bearingLines = useMapStore((s) => s.bearingLines);
  const removeBearingLine = useMapStore((s) => s.removeBearingLine);
  const clearBearingLines = useMapStore((s) => s.clearBearingLines);

  const [unit, setUnit] = useState('km');
  const [speed, setSpeed] = useState(120);

  if (!active || bearingLines.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.15 }}
        className="absolute top-14 left-3 z-20 w-72 bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Navigation size={12} className="text-cyan-400" />
            <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-400">
              BEARING LINES
            </span>
            <span className="text-[9px] text-zinc-600">
              {bearingLines.length}/5
            </span>
          </div>
          <button
            onClick={clearBearingLines}
            className="text-zinc-500 hover:text-red-400 transition-colors"
            title="Clear all"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Config row */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04]">
          <div className="flex gap-1">
            {UNITS.map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono tracking-wider transition-colors ${
                  unit === u
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="h-3 w-px bg-white/[0.06]" />
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="text-[9px] bg-zinc-900 border border-white/[0.06] rounded px-1.5 py-0.5 text-zinc-300 font-mono"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>{s} kph</option>
            ))}
          </select>
        </div>

        {/* Line list */}
        <div className="max-h-52 overflow-y-auto divide-y divide-white/[0.04]">
          {bearingLines.map((line, idx) => (
            <BearingLineRow
              key={line.id}
              line={line}
              index={idx}
              unit={unit}
              speed={speed}
              onRemove={() => removeBearingLine(line.id)}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function BearingLineRow({ line, index, unit, speed, onRemove }) {
  const { start, end } = line;
  const trueBearing = calculateBearing(start.lat, start.lng, end.lat, end.lng);
  const dist = calculateDistance(start.lat, start.lng, end.lat, end.lng, unit);
  const decl = magneticDeclination(start.lat, start.lng);
  const magBearing = (trueBearing - decl + 360) % 360;
  const distKm = unit === 'km' ? dist : calculateDistance(start.lat, start.lng, end.lat, end.lng, 'km');
  const travelTime = estimateTravelTime(distKm, speed);

  return (
    <div className="px-3 py-2 group hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-semibold text-cyan-400/70 tracking-wider">
          LINE {String.fromCharCode(65 + index)}
        </span>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"
        >
          <X size={10} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <MetricCell label="DISTANCE" value={formatDistance(dist, unit)} />
        <MetricCell label="TRUE BRG" value={formatBearing(trueBearing)} />
        <MetricCell label="MAG BRG" value={formatBearing(magBearing)} />
        <MetricCell label="ETA" value={travelTime} />
      </div>
    </div>
  );
}

function MetricCell({ label, value }) {
  return (
    <div>
      <div className="text-[8px] text-zinc-600 tracking-wider">{label}</div>
      <div className="text-[11px] font-mono font-medium text-zinc-200 tabular-nums">
        {value}
      </div>
    </div>
  );
}
