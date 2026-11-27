import { useState } from 'react';
import { clsx } from 'clsx';
import { FlaskConical, Trash2 } from 'lucide-react';
import { isDefaultRule } from '../../stores/alertRulesStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useMapStore } from '../../stores/mapStore';
import { useIntelStore } from '../../stores/intelStore';
import { previewRule } from '../../utils/alertEvaluator';

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
    <button
      onClick={onChange}
      className="shrink-0"
      aria-label={on ? 'Disable alert rule' : 'Enable alert rule'}
      title={on ? 'Disable alert rule' : 'Enable alert rule'}
    >
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
  const [preview, setPreview] = useState(null);
  const field = CONFIG_FIELDS[rule.type];
  const canDelete = !isDefaultRule(rule.id);

  const handleValueChange = (e) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && field) {
      onUpdate(rule.id, { config: { ...rule.config, [field.key]: val } });
    }
  };

  const runPreview = () => {
    const { data, fleet } = useTelemetryStore.getState();
    const drones = fleet.length > 0 ? fleet : (data ? [data] : []);
    setPreview(previewRule(rule, drones, useMapStore.getState().geofences, useIntelStore.getState().entities));
  };

  return (
    <div className={clsx(
      'flex flex-wrap items-center gap-3 p-3 rounded-xl border transition-all',
      'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]',
    )}>
      <div
        role="img"
        aria-label={`Severity: ${rule.severity}`}
        title={rule.severity}
        className={clsx('w-2 h-2 rounded-full shrink-0', SEVERITY_COLORS[rule.severity])}
      />

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

      <button
        type="button"
        onClick={runPreview}
        aria-label={`Test alert rule ${rule.name} against current fleet`}
        title="Dry run against current telemetry (sends no alert)"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-zinc-500 hover:text-indigo-400 transition-colors"
      >
        <FlaskConical size={14} />
      </button>

      <ToggleSwitch on={rule.enabled} onChange={() => onToggle(rule.id)} />

      {canDelete && (
        <button
          onClick={() => onRemove(rule.id)}
          aria-label={`Remove alert rule ${rule.name}`}
          title={`Remove alert rule ${rule.name}`}
          className="text-zinc-600 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      )}
      {preview && (
        <p role="status" className="basis-full pl-5 text-[10px] font-mono text-zinc-400">
          {preview.total === 0
            ? 'DRY RUN: no telemetry yet. Nothing to test.'
            : preview.hits.length === 0
              ? `DRY RUN: would not trigger (${preview.total} drone${preview.total === 1 ? '' : 's'} checked).`
              : `DRY RUN: would trigger on ${preview.hits.length} of ${preview.total}. ${preview.hits.map((h) => h.message).join('; ')}`}
          {!rule.enabled && ' Rule is disabled.'}
        </p>
      )}
    </div>
  );
}
