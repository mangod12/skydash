import { useState } from 'react';
import { clsx } from 'clsx';
import { toDMS, toUTM, toMGRS, formatDecimal } from '../../utils/coordinates';

const FORMATS = ['DD', 'DMS', 'UTM', 'MGRS'];

export default function CoordinateDisplay({ lat, lng }) {
  const [format, setFormat] = useState(0);

  if (lat == null || lng == null) return null;

  const getFormatted = () => {
    switch (FORMATS[format]) {
      case 'DD': return formatDecimal(lat, lng);
      case 'DMS': return toDMS(lat, lng);
      case 'UTM': return toUTM(lat, lng).formatted;
      case 'MGRS': return toMGRS(lat, lng);
      default: return formatDecimal(lat, lng);
    }
  };

  return (
    <div className="absolute bottom-3 left-3 z-20 pointer-events-auto">
      <button
        onClick={() => setFormat((f) => (f + 1) % FORMATS.length)}
        className="bg-zinc-900/80 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-800/80 transition-colors group"
      >
        <span className="text-[9px] font-semibold tracking-wider text-zinc-600 group-hover:text-zinc-400 transition-colors w-8">
          {FORMATS[format]}
        </span>
        <span className="text-[11px] font-mono tabular-nums text-zinc-300 tracking-wide">
          {getFormatted()}
        </span>
      </button>
    </div>
  );
}
