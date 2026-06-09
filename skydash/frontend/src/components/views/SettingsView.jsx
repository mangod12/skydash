import { clsx } from 'clsx';
import GlassCard from '../common/GlassCard';
import DataSources from '../common/DataSources';
import AuditLog from '../common/AuditLog';
import AlertRulesConfig from '../common/AlertRulesConfig';
import SystemHealth from '../common/SystemHealth';
import PlatformStatus from '../common/PlatformStatus';
import { startTour } from '../common/OnboardingTour';
import { PanelBoundary } from '../common/ErrorBoundary';
import { useUIStore } from '../../stores/uiStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { API_BASE } from '../../utils/runtimeConfig';

const THEMES = [
  { id: 'midnight', label: 'MIDNIGHT', desc: 'Dark zinc, indigo accents', color: 'bg-indigo-500' },
  { id: 'tactical', label: 'TACTICAL', desc: 'Pure black, green monochrome', color: 'bg-emerald-500' },
  { id: 'arctic', label: 'ARCTIC', desc: 'Light mode, blue accents', color: 'bg-blue-500' },
];

export default function SettingsView() {
  const { theme, setTheme } = useUIStore();
  const { fleet } = useTelemetryStore();

  return (
    <PanelBoundary name="Settings">
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200 tracking-wider mb-1">SETTINGS</h2>
          <p className="text-[11px] text-zinc-500">System configuration and preferences</p>
        </div>

        {/* Theme */}
        <GlassCard animate={false}>
          <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">DISPLAY THEME</h3>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={clsx(
                  'p-3 rounded-xl border text-left transition-all',
                  theme === t.id
                    ? 'border-indigo-500/30 bg-indigo-500/10'
                    : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={clsx('w-3 h-3 rounded-full', t.color)} />
                  <span className="text-[10px] font-bold tracking-wider text-zinc-300">{t.label}</span>
                </div>
                <span className="text-[9px] text-zinc-500">{t.desc}</span>
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Onboarding */}
        <GlassCard animate={false}>
          <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">ONBOARDING</h3>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Replay the guided tour of SkyDash features</span>
            <button
              onClick={startTour}
              className="px-3 py-1.5 text-[10px] font-semibold tracking-wider bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 rounded-lg transition-colors"
            >
              RESTART TOUR
            </button>
          </div>
        </GlassCard>

        {/* Connection */}
        <GlassCard animate={false}>
          <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">CONNECTION</h3>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-zinc-500">API Endpoint</span>
              <span className="font-mono text-zinc-300">{API_BASE.replace(/^https?:\/\//, '')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Protocol</span>
              <span className="font-mono text-zinc-300">WebSocket + HTTP fallback</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Active Drones</span>
              <span className="font-mono text-zinc-300">{fleet.length || 1}</span>
            </div>
          </div>
        </GlassCard>

        {/* System Health */}
        <SystemHealth />

        {/* Alert Rules */}
        <AlertRulesConfig />

        {/* Keyboard shortcuts */}
        <GlassCard animate={false}>
          <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">KEYBOARD SHORTCUTS</h3>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              ['Ctrl+K', 'Command palette'],
              ['D', 'Dashboard'],
              ['M', 'Map view'],
              ['T', 'Telemetry view'],
              ['I', 'Intel view'],
              ['O', 'Missions'],
              ['A', 'Analytics'],
              ['N', 'Notifications'],
              ['B', 'Toggle sidebar'],
              ['?', 'Show shortcuts'],
              ['Esc', 'Close panel'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-zinc-400">{desc}</span>
                <kbd className="px-2 py-0.5 text-[9px] font-mono bg-white/[0.04] border border-white/[0.08] rounded text-zinc-400">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Audit Log */}
        <AuditLog />

        {/* Data Sources */}
        <GlassCard animate={false}>
          <DataSources />
        </GlassCard>

        {/* About / Platform Status */}
        <PlatformStatus />
      </div>
    </div>
    </PanelBoundary>
  );
}
