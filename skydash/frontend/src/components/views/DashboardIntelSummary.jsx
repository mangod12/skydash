import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, Eye, MapPin } from 'lucide-react';
import GlassCard from '../common/GlassCard';

const FINDING_ICONS = {
  threat: AlertTriangle,
  trend: TrendingUp,
  surveillance: Eye,
  location: MapPin,
};

const FINDING_COLORS = {
  threat: 'text-red-400',
  trend: 'text-amber-400',
  surveillance: 'text-violet-400',
  location: 'text-cyan-400',
};

function generateFindings(entities, events, relationships) {
  const findings = [];

  // Critical entities
  const crits = entities.filter((e) => e.threatLevel === 'critical');
  if (crits.length > 0) {
    findings.push({
      type: 'threat',
      text: `${crits.length} critical-threat ${crits.length === 1 ? 'entity' : 'entities'} active: ${crits.map((e) => e.name).join(', ')}`,
      priority: 4,
    });
  }

  // High-threat entities
  const highs = entities.filter((e) => e.threatLevel === 'high');
  if (highs.length > 0) {
    findings.push({
      type: 'threat',
      text: `${highs.length} high-threat ${highs.length === 1 ? 'entity' : 'entities'} under surveillance`,
      priority: 3,
    });
  }

  // Recent critical events
  const recentCrit = events.filter((e) => e.severity === 'critical' && Date.now() - e.time < 1800000);
  if (recentCrit.length > 0) {
    findings.push({
      type: 'trend',
      text: `${recentCrit.length} critical events in last 30 minutes`,
      priority: 3,
    });
  }

  // Most connected entity
  const connCounts = {};
  relationships.forEach((r) => {
    connCounts[r.from] = (connCounts[r.from] || 0) + 1;
    connCounts[r.to] = (connCounts[r.to] || 0) + 1;
  });
  const topConn = Object.entries(connCounts).sort((a, b) => b[1] - a[1])[0];
  if (topConn) {
    const ent = entities.find((e) => e.id === topConn[0]);
    if (ent) {
      findings.push({
        type: 'surveillance',
        text: `Hub entity: ${ent.name} (${topConn[1]} connections)`,
        priority: 2,
      });
    }
  }

  // Entities with low confidence
  const lowConf = entities.filter((e) => e.confidence < 60);
  if (lowConf.length > 0) {
    findings.push({
      type: 'surveillance',
      text: `${lowConf.length} entities below 60% confidence — verification needed`,
      priority: 1,
    });
  }

  // Location clusters
  const withCoords = entities.filter((e) => e.coordinates);
  if (withCoords.length >= 3) {
    findings.push({
      type: 'location',
      text: `${withCoords.length} geo-located entities in operational area`,
      priority: 1,
    });
  }

  return findings.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

export default function DashboardIntelSummary({ entities, events, relationships }) {
  const findings = useMemo(
    () => generateFindings(entities, events, relationships),
    [entities, events, relationships],
  );

  return (
    <GlassCard className="!p-4">
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">
        INTEL SUMMARY
      </h3>
      {findings.length > 0 ? (
        <div className="space-y-2">
          {findings.map((f, i) => {
            const Icon = FINDING_ICONS[f.type] || Eye;
            const color = FINDING_COLORS[f.type] || 'text-zinc-400';
            return (
              <div key={i} className="flex items-start gap-2">
                <Icon size={12} className={`${color} mt-0.5 shrink-0`} />
                <span className="text-[11px] text-zinc-300 leading-tight">{f.text}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-zinc-700 text-[10px] text-center py-4">NO FINDINGS</div>
      )}
    </GlassCard>
  );
}
