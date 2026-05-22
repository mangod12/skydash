import { useState, useEffect, useMemo } from 'react';
import { useIntelStore } from '../../stores/intelStore';
import { useFeedStore } from '../../stores/feedStore';

/* ─── Threat Gauge Widget ──────────────────────────────── */

export function ThreatGaugeWidget() {
  const entities = useIntelStore((s) => s.entities);
  const score = useMemo(() => {
    if (entities.length === 0) return 0;
    const weights = { low: 0, medium: 25, high: 60, critical: 100 };
    const total = entities.reduce((s, e) => s + (weights[e.threatLevel] ?? 0), 0);
    return Math.round(total / entities.length);
  }, [entities]);

  const angle = (score / 100) * 180;
  const color = score > 70 ? '#ef4444' : score > 40 ? '#f59e0b' : '#10b981';

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <svg viewBox="0 0 120 70" className="w-full max-w-[160px]">
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={color}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 157} 157`} />
        <text x="60" y="55" textAnchor="middle" fill={color}
          fontSize="18" fontFamily="JetBrains Mono, monospace" fontWeight="bold">{score}</text>
        <text x="60" y="66" textAnchor="middle" fill="#71717a"
          fontSize="6" letterSpacing="0.1em">THREAT SCORE</text>
      </svg>
    </div>
  );
}

/* ─── Entity List Widget ───────────────────────────────── */

const THREAT_DOT = { low: 'bg-emerald-400', medium: 'bg-amber-400', high: 'bg-red-400', critical: 'bg-red-500' };
const THREAT_SORT = { critical: 0, high: 1, medium: 2, low: 3 };

export function EntityListWidget() {
  const entities = useIntelStore((s) => s.entities);
  const sorted = useMemo(() =>
    [...entities]
      .sort((a, b) => (THREAT_SORT[a.threatLevel] ?? 4) - (THREAT_SORT[b.threatLevel] ?? 4))
      .slice(0, 5),
  [entities]);

  return (
    <div className="space-y-1.5 h-full overflow-y-auto">
      <span className="text-[8px] text-zinc-600 tracking-wider">TOP 5 BY RISK</span>
      {sorted.map((e) => (
        <div key={e.id} className="flex items-center gap-2 py-1 border-b border-white/[0.04] last:border-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${THREAT_DOT[e.threatLevel] || 'bg-zinc-600'}`} />
          <span className="text-[10px] font-mono text-zinc-300 truncate flex-1">{e.name}</span>
          <span className="text-[8px] font-mono text-zinc-500 uppercase">{e.threatLevel}</span>
        </div>
      ))}
      {sorted.length === 0 && <span className="text-[10px] text-zinc-600">NO ENTITIES</span>}
    </div>
  );
}

/* ─── Feed Widget ──────────────────────────────────────── */

const SEV_DOT = { info: 'bg-indigo-400', warning: 'bg-amber-400', critical: 'bg-red-400' };

export function FeedWidget() {
  const items = useFeedStore((s) => s.items);
  const recent = items.slice(0, 5);

  if (recent.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] text-zinc-600 tracking-wider">
        NO INTEL FEED
      </div>
    );
  }

  return (
    <div className="space-y-1.5 h-full overflow-y-auto">
      {recent.map((item) => (
        <div key={item.id} className="flex items-start gap-2 py-1 border-b border-white/[0.04] last:border-0">
          <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${SEV_DOT[item.severity] || SEV_DOT.info}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-zinc-300 leading-tight truncate">{item.title}</p>
            <span className="text-[8px] font-mono text-zinc-600">{item.category}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Clock Widget ─────────────────────────────────────── */

export function ClockWidget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const utc = now.toISOString().slice(11, 19);
  const local = now.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = now.toISOString().slice(0, 10);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <span className="text-[8px] text-zinc-600 tracking-[0.15em]">UTC</span>
      <span className="text-lg font-mono font-bold tabular-nums text-cyan-400">{utc}</span>
      <span className="text-[8px] text-zinc-600 tracking-[0.15em] mt-1">LOCAL</span>
      <span className="text-sm font-mono tabular-nums text-zinc-300">{local}</span>
      <span className="text-[8px] font-mono text-zinc-600 mt-1">{dateStr}</span>
    </div>
  );
}

/* ─── Weather Widget ───────────────────────────────────── */

const CONDITIONS = [
  { label: 'CLEAR', wind: '8 kt NW', vis: '10+ km', temp: '18C' },
  { label: 'OVERCAST', wind: '12 kt W', vis: '6 km', temp: '14C' },
  { label: 'RAIN', wind: '18 kt SW', vis: '3 km', temp: '11C' },
  { label: 'FOG', wind: '4 kt VAR', vis: '0.8 km', temp: '9C' },
];

export function WeatherWidget() {
  const [idx] = useState(() => Math.floor(Math.random() * CONDITIONS.length));
  const wx = CONDITIONS[idx];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <span className="text-[8px] text-zinc-600 tracking-[0.15em]">CONDITIONS</span>
      <span className="text-sm font-mono font-bold text-indigo-400">{wx.label}</span>
      <div className="text-[9px] font-mono text-zinc-500 space-y-0.5 text-center mt-1">
        <div>WIND {wx.wind}</div>
        <div>VIS {wx.vis}</div>
        <div>TEMP {wx.temp}</div>
      </div>
    </div>
  );
}
