import { clsx } from 'clsx';
import { useIntelStore } from '../../stores/intelStore';

const THREAT_LEVELS = ['none', 'low', 'medium', 'high', 'critical'];
const ENTITY_TYPES = ['person', 'vehicle', 'building', 'device', 'event'];

const CELL_COLORS = {
  0: 'bg-zinc-800/30',
  1: 'bg-emerald-500/15 text-emerald-400',
  2: 'bg-amber-500/15 text-amber-400',
  3: 'bg-red-500/15 text-red-400',
};

export default function ThreatMatrix() {
  const entities = useIntelStore((s) => s.entities);

  const getCount = (type, threat) =>
    entities.filter((e) => e.type === type && e.threatLevel === threat).length;

  const getCellStyle = (count) => {
    if (count === 0) return CELL_COLORS[0];
    if (count === 1) return CELL_COLORS[1];
    if (count <= 3) return CELL_COLORS[2];
    return CELL_COLORS[3];
  };

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
        THREAT MATRIX
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-[9px]">
          <thead>
            <tr>
              <th className="text-left text-zinc-600 font-medium pb-2 pr-2"></th>
              {THREAT_LEVELS.map((level) => (
                <th
                  key={level}
                  className="text-center text-zinc-600 font-medium pb-2 px-1 tracking-wider uppercase"
                >
                  {level.slice(0, 4)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ENTITY_TYPES.map((type) => (
              <tr key={type}>
                <td className="text-zinc-500 font-medium py-1 pr-2 uppercase tracking-wider">
                  {type.slice(0, 6)}
                </td>
                {THREAT_LEVELS.map((threat) => {
                  const count = getCount(type, threat);
                  return (
                    <td key={threat} className="p-0.5 text-center">
                      <div className={clsx(
                        'rounded py-1 font-mono font-bold tabular-nums transition-colors',
                        getCellStyle(count),
                      )}>
                        {count || '-'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      <div className="flex justify-between items-center pt-2 border-t border-white/[0.04]">
        <span className="text-[9px] text-zinc-600">{entities.length} TOTAL ENTITIES</span>
        <div className="flex gap-2">
          {['high', 'critical'].map((level) => {
            const count = entities.filter((e) => e.threatLevel === level).length;
            if (count === 0) return null;
            return (
              <span
                key={level}
                className={clsx(
                  'text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded',
                  level === 'critical' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10',
                )}
              >
                {count} {level.toUpperCase()}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
