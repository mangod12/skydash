import { useState } from 'react';
import { clsx } from 'clsx';
import { Plus, X } from 'lucide-react';
import { RULE_TYPES } from '../../stores/alertRulesStore';

const TYPE_LABELS = {
  battery_low: 'Battery Low',
  signal_weak: 'Signal Weak',
  altitude_limit: 'Altitude Limit',
  speed_limit: 'Speed Limit',
  geofence_breach: 'Geofence Breach',
  proximity: 'Proximity Alert',
};

const SEVERITY_OPTIONS = ['info', 'warning', 'critical'];

const DEFAULT_CONFIGS = {
  battery_low: { threshold: 25 },
  signal_weak: { threshold: 40 },
  altitude_limit: { maxAlt: 100 },
  speed_limit: { maxSpeed: 12 },
  geofence_breach: {},
  proximity: { entityId: '', radiusM: 500 },
};

export default function AddRuleForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('battery_low');
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState('warning');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      type,
      enabled: true,
      config: { ...DEFAULT_CONFIGS[type] },
      severity,
      cooldownMs: severity === 'critical' ? 30000 : 60000,
    });
    setName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <Plus size={14} /> ADD RULE
      </button>
    );
  }

  return (
    <div className="border border-white/[0.08] rounded-xl p-3 space-y-3 bg-white/[0.02]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-400">NEW RULE</span>
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
          <X size={14} />
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Rule name..."
        className="w-full text-[11px] bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500/40"
      />

      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="flex-1 text-[10px] bg-zinc-900 border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-300 outline-none"
        >
          {RULE_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="text-[10px] bg-zinc-900 border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-300 outline-none"
        >
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!name.trim()}
        className={clsx(
          'w-full text-[10px] font-semibold tracking-wider py-2 rounded-lg transition-all',
          name.trim()
            ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30'
            : 'bg-white/[0.02] text-zinc-600 border border-white/[0.04] cursor-not-allowed',
        )}
      >
        CREATE RULE
      </button>
    </div>
  );
}
