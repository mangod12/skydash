import { useMemo } from 'react';
import PanelState from '../common/PanelState';
import GlassCard from '../common/GlassCard';
import ActivityItem from '../common/ActivityItem';
import { useActivityStore } from '../../stores/activityStore';

const ACTIVITY_FILTERS = ['all', 'intel', 'mission', 'system', 'alert', 'telemetry'];

export default function DashboardActivityFeed() {
  const activityFilter = useActivityStore((s) => s.filter);
  const setActivityFilter = useActivityStore((s) => s.setFilter);
  const activities = useActivityStore((s) => s.activities);
  const filteredActivities = useMemo(() => activityFilter === 'all' ? activities : activities.filter(activity => activity.category === activityFilter), [activities, activityFilter]);

  return (
    <GlassCard className="!p-4 h-full" animate={false}>
      <section aria-label="Session activity records"><div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          SESSION ACTIVITY
        </span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Activity category filter">
          {ACTIVITY_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActivityFilter(f)}
              className={`text-[8px] px-1.5 py-0.5 rounded font-mono tracking-wider transition-colors ${
                activityFilter === f
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-zinc-400 mb-3 leading-relaxed">Only events explicitly added by this browser session appear here. No seeded incidents, login history or telemetry alerts. Not a server audit log, radio transcript or recorded-flight debrief. Missing entries do not prove no activity or a safe aircraft state.</p>
      <div className="space-y-1 overflow-y-auto max-h-[440px] pr-1 custom-scrollbar">
        {filteredActivities.length === 0 ? (
          <PanelState title={activityFilter === 'all' ? 'No session activity records' : 'No matching session records'} hint="No recorded entries for this view, not confirmation of radio silence, no incidents or flight readiness." />
        ) : (
          filteredActivities.slice(0, 20).map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))
        )}
      </div></section>
    </GlassCard>
  );
}
