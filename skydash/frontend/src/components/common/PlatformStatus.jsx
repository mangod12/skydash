import { CheckCircle, ExternalLink } from 'lucide-react';
import GlassCard from './GlassCard';
import { version } from '../../../package.json';

const INVENTORY = [
  ['Components', 90],
  ['Stores', 10],
  ['Hooks', 11],
  ['Views', 8],
  ['API Endpoints', 28],
  ['Themes', 3],
  ['Shortcuts', 11],
  ['Export Formats', 5],
];

const CAPABILITIES = [
  'Real-time telemetry (10Hz WebSocket)',
  '3-drone fleet simulation',
  'OSINT entity tracking (6 types)',
  'Link analysis with graph algorithms',
  'Mission investigation workspace',
  'Configurable alert rules engine',
  'Pattern detection (6 algorithms)',
  'Evidence chain / provenance',
  'Map annotations & geofence zones',
  'Spatial radius search',
  'Split-view dual map comparison',
  '5 export formats (GeoJSON/KML/CSV/TXT)',
  'Printable intelligence report',
  'ADS-B aircraft tracking',
  'Responsive (mobile/tablet/desktop)',
];

const TECH = [
  'React 18', 'Vite 8', 'Tailwind 3', 'Zustand',
  'Leaflet', 'D3', 'Recharts', 'Framer Motion',
  'FastAPI', 'SQLite', 'WebSocket',
];

const BUILD = [
  ['Source Files', '127'],
  ['Lines', '13,518'],
  ['Bundle', 'Code-split'],
  ['Dev Phases', '16'],
];

const SectionLabel = ({ children }) => (
  <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3 mt-5 first:mt-0">
    {children}
  </h3>
);

export default function PlatformStatus() {
  return (
    <GlassCard animate={false}>
      <div className="mb-4">
        <h2 className="text-xs font-bold tracking-wider text-zinc-200">SKYDASH SPATIAL INTELLIGENCE PLATFORM</h2>
        <span className="font-mono text-[11px] text-indigo-400">v{version}</span>
      </div>

      <div className="border-t border-white/[0.06] pt-4">
        <SectionLabel>PLATFORM INVENTORY</SectionLabel>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
          {INVENTORY.map(([label, count]) => (
            <div key={label} className="flex justify-between py-0.5">
              <span className="text-zinc-500">{label}</span>
              <span className="font-mono text-zinc-300">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/[0.06] pt-4 mt-4">
        <SectionLabel>CAPABILITIES</SectionLabel>
        <ul className="space-y-1">
          {CAPABILITIES.map((cap) => (
            <li key={cap} className="flex items-start gap-2 text-[11px] text-zinc-400">
              <CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" />
              {cap}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-white/[0.06] pt-4 mt-4">
        <SectionLabel>TECH STACK</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {TECH.map((t) => (
            <span key={t} className="px-2 py-0.5 text-[9px] font-mono font-medium tracking-wide bg-white/[0.04] border border-white/[0.08] rounded text-zinc-400">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-white/[0.06] pt-4 mt-4">
        <SectionLabel>BUILD</SectionLabel>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
          {BUILD.map(([label, val]) => (
            <div key={label} className="flex justify-between py-0.5">
              <span className="text-zinc-500">{label}</span>
              <span className="font-mono text-zinc-300">{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/[0.06] pt-4 mt-4 flex items-center justify-between text-[10px] text-zinc-600">
        <span>MIT License</span>
        <a
          href="https://github.com/mangod12/skydash"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-zinc-500 hover:text-indigo-400 transition-colors"
        >
          github.com/mangod12/skydash
          <ExternalLink size={10} />
        </a>
      </div>
    </GlassCard>
  );
}
