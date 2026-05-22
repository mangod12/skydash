import { useMemo, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Wifi, WifiOff, Shield, Crosshair, Activity } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { StatCard, ActivityFeed } from './DashboardCards';
import DashboardMiniMap from './DashboardMiniMap';
import FleetSparklines from './FleetSparklines';
import FleetOverview from '../telemetry/FleetOverview';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';
import useNotificationStore from '../../stores/notificationStore';

const EASE = [0.16, 1, 0.3, 1];

function buildFeedItems(notifications, events, alerts) {
  const items = [];

  notifications.forEach((n) => {
    const ts = n.timestamp instanceof Date ? n.timestamp : new Date(n.timestamp);
    items.push({
      id: `notif-${n.id}`,
      description: n.message || n.title,
      severity: n.severity || 'info',
      time: ts.getTime(),
      timeLabel: formatDistanceToNow(ts, { addSuffix: true }),
    });
  });

  events.forEach((e) => {
    items.push({
      id: `evt-${e.id}`,
      description: e.description,
      severity: e.severity || 'info',
      time: e.time,
      timeLabel: formatDistanceToNow(e.time, { addSuffix: true }),
    });
  });

  alerts.forEach((a) => {
    items.push({
      id: `alert-${a.id}`,
      description: a.message,
      severity: a.severity || 'warning',
      time: a.timestamp,
      timeLabel: formatDistanceToNow(a.timestamp, { addSuffix: true }),
    });
  });

  // Deduplicate by description, keep newest
  const seen = new Map();
  items.forEach((item) => {
    const existing = seen.get(item.description);
    if (!existing || existing.time < item.time) seen.set(item.description, item);
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

  const feedItems = useMemo(
    () => buildFeedItems(notifications, events, alerts),
    [notifications, events, alerts],
  );

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-7xl mx-auto space-y-3">
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
              <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 block mb-3">
                RECENT ACTIVITY
              </span>
              <ActivityFeed items={feedItems} />
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
