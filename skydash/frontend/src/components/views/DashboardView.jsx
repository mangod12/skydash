import { useMemo, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Wifi, WifiOff, Shield, Crosshair, Activity, LayoutGrid, LayoutList } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import DataFreshnessBar from '../common/DataFreshnessBar';
import { StatCard } from './DashboardCards';
import ActivityItem from '../common/ActivityItem';
import { useActivityStore } from '../../stores/activityStore';
import DashboardMiniMap from './DashboardMiniMap';
import FleetSparklines from './FleetSparklines';
import FleetOverview from '../telemetry/FleetOverview';
import WidgetGrid from './WidgetGrid';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';
import useNotificationStore from '../../stores/notificationStore';

const EASE = [0.16, 1, 0.3, 1];

function toFeedItem(id, desc, sev, time) {
  return { id, description: desc, severity: sev, time, timeLabel: formatDistanceToNow(time, { addSuffix: true }) };
}

function buildFeedItems(notifications, events, alerts) {
  const items = [
    ...notifications.map((n) => {
      const ts = n.timestamp instanceof Date ? n.timestamp : new Date(n.timestamp);
      return toFeedItem(`notif-${n.id}`, n.message || n.title, n.severity || 'info', ts.getTime());
    }),
    ...events.map((e) => toFeedItem(`evt-${e.id}`, e.description, e.severity || 'info', e.time)),
    ...alerts.map((a) => toFeedItem(`alert-${a.id}`, a.message, a.severity || 'warning', a.timestamp)),
  ];
  const seen = new Map();
  items.forEach((item) => {
    const ex = seen.get(item.description);
    if (!ex || ex.time < item.time) seen.set(item.description, item);
  });
  return [...seen.values()].sort((a, b) => b.time - a.time).slice(0, 15);
}

export default function DashboardView() {
  const fleet = useTelemetryStore((s) => s.fleet);
  const isConnected = useTelemetryStore((s) => s.isConnected);
  const latency = useTelemetryStore((s) => s.latency);
  const alerts = useTelemetryStore((s) => s.alerts);
  const entities = useIntelStore((s) => s.entities);
  const events = useIntelStore((s) => s.events);
  const missions = useMissionStore((s) => s.missions);
  const fetchMissions = useMissionStore((s) => s.fetchMissions);
  const notifications = useNotificationStore((s) => s.notifications);
  const [widgetMode, setWidgetMode] = useState(false);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  // ── Data freshness ticker ──
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatFreshness = useCallback((timestamp) => {
    if (!timestamp) return null;
    return `Updated ${formatDistanceToNow(timestamp, { addSuffix: true })}`;
  }, []);

  // Track last-seen timestamps per category
  const fleetUpdatedAt = fleet.length > 0 && isConnected ? now : null;
  const entitiesUpdatedAt = entities.length > 0
    ? Math.max(...entities.map((e) => e.lastSeen || 0))
    : null;

  // ── Derived stats ──
  const droneCount = fleet.length;
  const avgBattery = fleet.length > 0
    ? Math.round(fleet.reduce((s, d) => s + (d.battery_percentage ?? 0), 0) / fleet.length)
    : 0;
  const allConnected = fleet.length > 0 && isConnected;

  const threatCounts = useMemo(() => {
    const c = { low: 0, medium: 0, high: 0, critical: 0 };
    entities.forEach((e) => { if (c[e.threatLevel] !== undefined) c[e.threatLevel]++; });
    return c;
  }, [entities]);

  const mediumPlus = threatCounts.medium + threatCounts.high + threatCounts.critical;
  const threatScore = entities.length > 0 ? Math.round((mediumPlus / entities.length) * 100) : 0;
  const threatAccent = threatCounts.critical > 0 ? 'red' : threatCounts.high > 0 ? 'amber' : 'emerald';

  const activeMissions = missions.filter((m) => m.status === 'active');
  const linkedEntities = missions.reduce((s, m) => s + (m.entityIds?.length || 0), 0);
  const dataRate = fleet.length > 0 ? `${fleet.length * 2} msg/s` : '0 msg/s';

  const feedItems = useMemo(() => buildFeedItems(notifications, events, alerts), [notifications, events, alerts]);
  const activityFilter = useActivityStore((s) => s.filter);
  const setActivityFilter = useActivityStore((s) => s.setFilter);
  const filteredActivities = useActivityStore((s) => s.getFiltered());
  const ACTIVITY_FILTERS = ['all', 'intel', 'mission', 'system', 'alert', 'telemetry'];

  if (widgetMode) {
    return (
      <div className="h-full relative">
        <button onClick={() => setWidgetMode(false)}
          className="absolute top-4 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-mono text-zinc-500 border border-white/[0.06] hover:border-white/[0.12] hover:text-zinc-300 bg-zinc-950/80 backdrop-blur transition-all">
          <LayoutList size={12} /> CLASSIC VIEW
        </button>
        <WidgetGrid />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* ── Data Freshness Bar + Widget Toggle ── */}
        <div className="flex items-center justify-between">
          <DataFreshnessBar />
          <button
            onClick={() => setWidgetMode(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-mono
                       text-zinc-500 border border-white/[0.06] hover:border-indigo-500/30
                       hover:text-indigo-400 hover:bg-indigo-500/10 transition-all shrink-0"
          >
            <LayoutGrid size={12} /> WIDGETS
          </button>
        </div>

        {/* ── Top Row: 4 Stat Cards ── */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="FLEET STATUS" value={droneCount} icon={Wifi}
            sub={allConnected ? `ALL CONNECTED \u00B7 ${avgBattery}% AVG BAT`
              : droneCount > 0 ? `PARTIAL \u00B7 ${avgBattery}% AVG BAT` : 'NO DRONES'}
            accent={allConnected ? 'emerald' : 'amber'} index={0}
            freshness={formatFreshness(fleetUpdatedAt)}
          />
          <StatCard
            label="THREAT OVERVIEW" value={threatCounts.high + threatCounts.critical} icon={Shield}
            sub={`${threatCounts.high} HIGH \u00B7 ${threatCounts.critical} CRIT \u00B7 ${threatScore}% SCORE`}
            accent={threatAccent} index={1}
            freshness={formatFreshness(entitiesUpdatedAt)}
          />
          <StatCard
            label="ACTIVE MISSIONS" value={activeMissions.length} icon={Crosshair}
            sub={`${linkedEntities} LINKED ENTITIES \u00B7 ${entities.length} TOTAL`}
            accent="indigo" index={2}
            freshness={activeMissions.length > 0
              ? formatFreshness(new Date(activeMissions[0].created_at).getTime())
              : null}
          />
          <StatCard
            label="SYSTEM HEALTH" value={isConnected ? 'ONLINE' : 'OFFLINE'}
            icon={isConnected ? Activity : WifiOff}
            sub={isConnected ? `${latency}ms LATENCY \u00B7 ${dataRate}` : 'RECONNECTING...'}
            accent={isConnected ? 'cyan' : 'red'} index={3}
            freshness={isConnected ? 'Updated just now' : 'Connection lost'}
          />
        </div>

        {/* ── Fleet Overview Table ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35, ease: EASE }}>
          <FleetOverview />
        </motion.div>

        {/* ── Bottom Row: Map + Sparklines | Activity Feed ── */}
        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-3 space-y-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4, ease: EASE }}>
              <GlassCard className="!p-3" animate={false}>
                <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 block mb-2">
                  OPERATIONAL MAP
                </span>
                <DashboardMiniMap />
              </GlassCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5, ease: EASE }}>
              <GlassCard className="!p-4" animate={false}>
                <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 block mb-3">
                  FLEET TELEMETRY
                </span>
                <FleetSparklines />
              </GlassCard>
            </motion.div>
          </div>

          <motion.div className="col-span-2" initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.45, ease: EASE }}>
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
          </motion.div>
        </div>
      </div>
    </div>
  );
}
