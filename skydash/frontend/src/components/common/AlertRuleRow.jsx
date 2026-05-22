import { useState } from 'react';
import { clsx } from 'clsx';
import { Trash2 } from 'lucide-react';
import { isDefaultRule } from '../../stores/alertRulesStore';

const SEVERITY_COLORS = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

const TYPE_LABELS = {
  battery_low: 'BATTERY',
  signal_weak: 'SIGNAL',
  altitude_limit: 'ALTITUDE',
  speed_limit: 'SPEED',
  geofence_breach: 'GEOFENCE',
  proximity: 'PROXIMITY',
};

const CONFIG_FIELDS = {
  battery_low: { key: 'threshold', label: 'THRESHOLD %', unit: '%' },
  signal_weak: { key: 'threshold', label: 'THRESHOLD %', unit: '%' },
  altitude_limit: { key: 'maxAlt', label: 'MAX ALT', unit: 'm' },
  speed_limit: { key: 'maxSpeed', label: 'MAX SPEED', unit: 'm/s' },
  proximity: { key: 'radiusM', label: 'RADIUS', unit: 'm' },
};

function ToggleSwitch({ on, onChange }) {
  return (
    <button onClick={onChange} className="shrink-0">
      <div className={clsx(
        'w-8 h-4 rounded-full relative transition-colors',
        on ? 'bg-indigo-500' : 'bg-zinc-700',
      )}>
        <div className={clsx(
          'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all',
          on ? 'left-[18px]' : 'left-0.5',
        )} />
      </div>
    </button>
  );
}

export default function AlertRuleRow({ rule, onToggle, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const field = CONFIG_FIELDS[rule.type];
  const canDelete = !isDefaultRule(rule.id);

  const handleValueChange = (e) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && field) {
      onUpdate(rule.id, { config: { ...rule.config, [field.key]: val } });
    }
  };

  return (
    <div className={clsx(
      'flex items-center gap-3 p-3 rounded-xl border transition-all',
      'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]',
    )}>
      <div className={clsx('w-2 h-2 rounded-full shrink-0', SEVERITY_COLORS[rule.severity])} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] text-zinc-200 font-medium truncate">{rule.name}</span>
          <span className="text-[8px] font-bold tracking-[0.15em] text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
            {TYPE_LABELS[rule.type] || rule.type.toUpperCase()}
          </span>
        </div>

        {field && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] tracking-[0.1em] text-zinc-500">{field.label}</span>
            {editing ? (
              <input
                type="number"
                defaultValue={rule.config[field.key]}
                onBlur={(e) => { handleValueChange(e); setEditing(false); }}
                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                autoFocus
                className="w-16 text-[11px] font-mono text-cyan-400 bg-white/[0.06] border border-white/[0.1] rounded px-1.5 py-0.5 outline-none focus:border-indigo-500/50"
              />
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                {rule.config[field.key]}{field.unit}
              </button>
            )}
          </div>
        )}
      </div>

      <ToggleSwitch on={rule.enabled} onChange={() => onToggle(rule.id)} />

      {canDelete && (
        <button
          onClick={() => onRemove(rule.id)}
          className="text-zinc-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
