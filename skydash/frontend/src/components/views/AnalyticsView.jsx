import { useMemo } from 'react';
import GlassCard from '../common/GlassCard';
import RiskOverview from '../intel/RiskOverview';
import { PanelBoundary } from '../common/ErrorBoundary';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { generateNetworkSummary } from '../../utils/networkAnalysis';
import { EntityDistributionChart, ThreatBreakdownChart, AltitudeTrendChart } from './AnalyticsCharts';
import ThreatTrendChart from './ThreatTrendChart';
import TemporalHeatmap from './TemporalHeatmap';
import EntityTypeCards from './EntityTypeCards';
import AnalyticsNetwork from './AnalyticsNetwork';

function StatCard({ label, value, sub, color = 'text-indigo-400' }) {
  return (
    <div className="text-center">
      <div className="text-[9px] text-zinc-600 tracking-wider uppercase mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AnalyticsView() {
  const entities = useIntelStore((s) => s.entities);
  const relationships = useIntelStore((s) => s.relationships);
  const events = useIntelStore((s) => s.events);
  const history = useTelemetryStore((s) => s.history);
  const fleet = useTelemetryStore((s) => s.fleet);

  const networkSummary = useMemo(
    () => generateNetworkSummary(entities, relationships || [], events),
    [entities, relationships, events],
  );

  const typeData = Object.entries(
    entities.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const threatData = Object.entries(
    entities.reduce((acc, e) => {
      acc[e.threatLevel] = (acc[e.threatLevel] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const entityEventCounts = {};
  events.forEach((e) => {
    if (e.entityId) entityEventCounts[e.entityId] = (entityEventCounts[e.entityId] || 0) + 1;
  });
  const topEntities = Object.entries(entityEventCounts)
    .map(([id, count]) => ({
      name: entities.find((e) => e.id === id)?.name || id,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const highThreatCount = entities.filter((e) => e.threatLevel === 'high' || e.threatLevel === 'critical').length;

  return (
    <PanelBoundary name="Analytics">
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Top stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <GlassCard className="!p-4">
            <StatCard label="TOTAL ENTITIES" value={entities.length} color="text-indigo-400" />
          </GlassCard>
          <GlassCard className="!p-4">
            <StatCard label="ACTIVE EVENTS" value={events.length} color="text-cyan-400" />
          </GlassCard>
          <GlassCard className="!p-4">
            <StatCard label="HIGH THREAT" value={highThreatCount} color={highThreatCount > 0 ? 'text-red-400' : 'text-emerald-400'} />
          </GlassCard>
          <GlassCard className="!p-4">
            <StatCard label="ACTIVE DRONES" value={fleet.length} color={fleet.length > 0 ? 'text-violet-400' : 'text-zinc-500'} />
          </GlassCard>
        </div>

        {/* Threat timeline + heatmap */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ThreatTrendChart events={events} />
          <TemporalHeatmap events={events} />
        </div>

        {/* Entity type breakdown */}
        <EntityTypeCards entities={entities} />

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <EntityDistributionChart typeData={typeData} />
          <ThreatBreakdownChart threatData={threatData} />
          <AltitudeTrendChart history={history} />
        </div>

        {/* Risk Assessment */}
        <RiskOverview />

        {/* Network Intelligence + Top Entities + Fleet */}
        <AnalyticsNetwork
          networkSummary={networkSummary}
          topEntities={topEntities}
          fleet={fleet}
        />
      </div>
    </div>
    </PanelBoundary>
  );
}
