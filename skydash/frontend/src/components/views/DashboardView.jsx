import { useMemo, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Wifi, WifiOff, Shield, Crosshair, Activity, LayoutGrid, LayoutList } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import DataFreshnessBar from '../common/DataFreshnessBar';
import { PanelBoundary } from '../common/ErrorBoundary';
import { StatCard } from './DashboardCards';
import DashboardActivityFeed from './DashboardActivityFeed';
import ThreatGaugeCard from './ThreatGaugeCard';
import DashboardIntelSummary from './DashboardIntelSummary';
import DashboardMiniMap from './DashboardMiniMap';
import FleetSparklines from './FleetSparklines';
import FleetOverview from '../telemetry/FleetOverview';
import AlertTimeline from './AlertTimeline';
import MissionProgressCard from './MissionProgressCard';
import EntityRadar from './EntityRadar';
import CommsLog from './CommsLog';
import WidgetGrid from './WidgetGrid';
import ScenarioSummaryCard from './ScenarioSummaryCard';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';
import { BACKEND_CONFIGURED } from '../../utils/runtimeConfig';

const EASE = [0.16, 1, 0.3, 1];

export default function DashboardView() {
  const fleet = useTelemetryStore((s) => s.fleet);
  const isConnected = useTelemetryStore((s) => s.isConnected);
  const latency = useTelemetryStore((s) => s.latency);
  const entities = useIntelStore((s) => s.entities);
  const events = useIntelStore((s) => s.events);
  const relationships = useIntelStore((s) => s.relationships);
  const missions = useMissionStore((s) => s.missions);
  const fetchMissions = useMissionStore((s) => s.fetchMissions);
  const [widgetMode, setWidgetMode] = useState(false);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  // ── Data freshness ticker ──
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
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
  const systemHealth = BACKEND_CONFIGURED
    ? {
        value: isConnected ? 'ONLINE' : 'OFFLINE',
        icon: isConnected ? Activity : WifiOff,
        sub: isConnected ? `${latency}ms LATENCY \u00B7 ${dataRate}` : 'RECONNECTING...',
        accent: isConnected ? 'cyan' : 'red',
        freshness: isConnected ? 'Updated just now' : 'Connection lost',
      }
    : {
        value: 'STATIC',
        icon: Activity,
        sub: 'BACKEND NOT CONFIGURED',
        accent: 'indigo',
        freshness: 'API/WS disabled',
      };

  if (widgetMode) {
    return (
      <PanelBoundary name="Dashboard">
        <div className="h-full relative">
          <button onClick={() => setWidgetMode(false)}
            className="absolute top-4 right-4 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-mono text-zinc-500 border border-white/[0.06] hover:border-white/[0.12] hover:text-zinc-300 bg-zinc-950/80 backdrop-blur transition-all">
            <LayoutList size={12} /> CLASSIC VIEW
          </button>
          <WidgetGrid />
        </div>
      </PanelBoundary>
    );
  }

  return (
    <PanelBoundary name="Dashboard">
    <div className="h-full overflow-y-auto overflow-x-hidden p-4">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* ── Data Freshness Bar + Widget Toggle ── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

        <ScenarioSummaryCard />

        {/* ── Top Row: 4 Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
            label="SYSTEM HEALTH" value={systemHealth.value}
            icon={systemHealth.icon}
            sub={systemHealth.sub}
            accent={systemHealth.accent} index={3}
            freshness={systemHealth.freshness}
          />
        </div>

        {/* ── Alert Timeline ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28, ease: EASE }}>
          <AlertTimeline events={events} />
        </motion.div>

        {/* ── Threat Gauge + Mission Progress + Intel Summary ── */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
          <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3, ease: EASE }}>
            <ThreatGaugeCard
              score={threatScore}
              highCount={threatCounts.high}
              critCount={threatCounts.critical}
            />
          </motion.div>
          <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.33, ease: EASE }}>
            <MissionProgressCard mission={activeMissions[0] || null} />
          </motion.div>
          <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35, ease: EASE }}>
            <DashboardIntelSummary
              entities={entities}
              events={events}
              relationships={relationships}
            />
          </motion.div>
        </div>

        {/* ── Fleet Overview Table ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4, ease: EASE }}>
          <FleetOverview />
        </motion.div>

        {/* ── Bottom Row: Map + Radar | Sparklines + Comms | Activity Feed ── */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45, ease: EASE }}>
              <GlassCard className="!p-3" animate={false}>
                <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 block mb-2">
                  OPERATIONAL MAP
                </span>
                <DashboardMiniMap />
              </GlassCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5, ease: EASE }}>
              <EntityRadar />
            </motion.div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.48, ease: EASE }}>
              <GlassCard className="!p-4" animate={false}>
                <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 block mb-3">
                  FLEET TELEMETRY
                </span>
                <FleetSparklines />
              </GlassCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.52, ease: EASE }}>
              <CommsLog />
            </motion.div>
          </div>

          <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5, ease: EASE }}>
            <DashboardActivityFeed />
          </motion.div>
        </div>
      </div>
    </div>
    </PanelBoundary>
  );
}
