import GlassCard from '../common/GlassCard';
import ActivityItem from '../common/ActivityItem';
import { useActivityStore } from '../../stores/activityStore';

const ACTIVITY_FILTERS = ['all', 'intel', 'mission', 'system', 'alert', 'telemetry'];

export default function DashboardActivityFeed() {
  const activityFilter = useActivityStore((s) => s.filter);
  const setActivityFilter = useActivityStore((s) => s.setFilter);
  const filteredActivities = useActivityStore((s) => s.getFiltered());

  return (
    <GlassCard className="!p-4 h-full" animate={false}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          ACTIVITY FEED
        </span>
        <div className="flex gap-1">
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
      <div className="space-y-1 overflow-y-auto max-h-[440px] pr-1 custom-scrollbar">
        {filteredActivities.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-zinc-700 text-[10px] tracking-wider">
            NO ACTIVITY
          </div>
        ) : (
          filteredActivities.slice(0, 20).map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))
        )}
      </div>
    </GlassCard>
  );
}
