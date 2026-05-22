import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { clsx } from 'clsx';
import GlassCard from './GlassCard';
import { useSystemHealth } from '../../hooks/useSystemHealth';

const STATUS_CFG = {
  healthy:  { label: 'HEALTHY',  dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]', text: 'text-emerald-400' },
  degraded: { label: 'DEGRADED', dot: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]',  text: 'text-amber-400' },
  error:    { label: 'ERROR',    dot: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]',      text: 'text-red-400' },
};

function formatDuration(ms) {
  if (ms == null) return '--:--:--';
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function Sparkline({ data }) {
  if (data.length < 2) return <span className="text-[9px] text-zinc-600 font-mono">--</span>;
  return (
    <div className="w-[100px] h-[24px] inline-block align-middle">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="v" stroke="#22d3ee" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProgressBar({ used, max, label }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const color = pct > 90 ? 'bg-amber-500' : 'bg-cyan-500/70';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] text-zinc-500 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-cyan-400 tabular-nums w-20 text-right">
        {used.toLocaleString()}/{max.toLocaleString()}
      </span>
    </div>
  );
}

function SectionHeader({ title }) {
  return <h4 className="text-[9px] font-semibold tracking-[0.15em] text-zinc-500 mt-3 mb-1.5">{title}</h4>;
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-cyan-400 tabular-nums">{children}</span>
    </div>
  );
}

export default function SystemHealth() {
  const h = useSystemHealth();
  const cfg = STATUS_CFG[h.status];

  return (
    <GlassCard animate={false}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">SYSTEM HEALTH</h3>
        <div className="flex items-center gap-2">
          <div className={clsx('w-2 h-2 rounded-full animate-pulse', cfg.dot)} />
          <span className={clsx('text-[9px] font-bold tracking-widest', cfg.text)}>{cfg.label}</span>
        </div>
      </div>

      <div className="space-y-0.5">
        <SectionHeader title="WEBSOCKET" />
        <Row label="Status">{h.ws.isConnected ? 'CONNECTED' : 'DISCONNECTED'}</Row>
        <Row label="Latency">{h.ws.latency}ms</Row>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Messages/s</span>
          <Sparkline data={h.rateHistory} />
        </div>

        <SectionHeader title="TELEMETRY PIPELINE" />
        <Row label="Drones">{h.pipeline.activeDrones}/{h.pipeline.total} active</Row>
        <Row label="Update rate">10 Hz</Row>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Data points: {h.pipeline.dataPoints.toLocaleString()}</span>
          <Sparkline data={h.latencyHistory} />
        </div>

        <SectionHeader title="ENTITY DATABASE" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <Row label="Entities">{h.database.entities}</Row>
          <Row label="Relationships">{h.database.relationships}</Row>
          <Row label="Events">{h.database.events}</Row>
        </div>

        <SectionHeader title="MEMORY USAGE" />
        <div className="space-y-1.5">
          <ProgressBar used={h.memory.historyUsed} max={h.memory.historyMax} label="Telemetry buffer" />
          <ProgressBar used={h.memory.notifications} max={h.memory.notificationsMax} label="Notifications" />
          <ProgressBar used={h.memory.audit} max={h.memory.auditMax} label="Audit entries" />
          <Row label="Annotations">{h.memory.annotations}</Row>
        </div>

        <SectionHeader title="UPTIME" />
        <Row label="Session">{formatDuration(h.uptime.session)}</Row>
        <Row label="Backend">{formatDuration(h.uptime.backend != null ? h.uptime.backend * 1000 : null)}</Row>
      </div>
    </GlassCard>
  );
}
