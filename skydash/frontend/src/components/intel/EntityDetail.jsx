import { MapPin, Link2, Activity, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import GlassCard from '../common/GlassCard';
import SourceReliability from '../common/SourceReliability';
import MiniRelGraph from './MiniRelGraph';
import MiniTimeline from './MiniTimeline';
import EntityMiniMap from './EntityMiniMap';
import EvidenceChain from './EvidenceChain';
import RiskScoreCard from './RiskScoreCard';
import { QuickStatsPills, ThreatBadges, ThreatAssessment } from './QuickStats';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';
import { useUIStore } from '../../stores/uiStore';
import { useEntityNavigation } from '../../hooks/useEntityNavigation';
import { formatDecimal } from '../../utils/coordinates';

export default function EntityDetail() {
  const entity = useIntelStore((s) => s.getSelectedEntity());
  const clearSelection = useIntelStore((s) => s.clearSelection);
  const relationships = useIntelStore((s) =>
    entity ? s.getEntityRelationships(entity.id) : []
  );
  const events = useIntelStore((s) =>
    entity ? s.getEntityEvents(entity.id) : []
  );
  const entities = useIntelStore((s) => s.entities);
  const missions = useMissionStore((s) => s.missions);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const { flyToEntity } = useEntityNavigation();

  if (!entity) return null;

  const getEntityName = (id) => entities.find((e) => e.id === id)?.name ?? id;

  const missionCount = missions.filter(
    (m) => (m.entityIds || []).includes(entity.id)
  ).length;

  return (
    <div className="h-full flex flex-col bg-[var(--surface-0)] border-l border-white/[0.06]">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06] flex items-start justify-between shrink-0">
        <div>
          <div className="text-sm font-semibold text-zinc-200">{entity.name}</div>
          <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">
            {entity.type} &middot; {entity.source}
          </div>
        </div>
        <button
          onClick={clearSelection}
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Quick Stats Bar */}
        <QuickStatsPills
          relCount={relationships.length}
          eventCount={events.length}
          missionCount={missionCount}
          confidence={entity.confidence}
        />

        {/* Threat + Confidence badges */}
        <ThreatBadges threatLevel={entity.threatLevel} confidence={entity.confidence} />

        {/* Threat Assessment Bars */}
        <ThreatAssessment threatLevel={entity.threatLevel} confidence={entity.confidence} />

        {/* Source Reliability */}
        <SourceReliability score={entity.confidence} label="SOURCE RELIABILITY" />

        {/* Risk Score */}
        <RiskScoreCard entityId={entity.id} />

        {/* Evidence Chain / Provenance */}
        <EvidenceChain entityId={entity.id} confidence={entity.confidence} />

        {/* Properties */}
        <div className="border-t border-white/[0.06] pt-3">
          <GlassCard className="!p-3" animate={false}>
            <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">PROPERTIES</h4>
            <div className="space-y-1.5">
              {Object.entries(entity.properties).map(([key, value]) => (
                <div key={key} className="flex justify-between items-baseline">
                  <span className="text-[10px] text-zinc-500 uppercase">{key}</span>
                  <span className="text-[11px] font-mono text-zinc-300">{String(value)}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Location Section */}
        {entity.coordinates && (
          <div className="border-t border-white/[0.06] pt-3">
            <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
              <MapPin size={10} /> LOCATION
            </h4>
            <div className="space-y-2">
              <EntityMiniMap coordinates={entity.coordinates} threatLevel={entity.threatLevel} />
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono tabular-nums text-zinc-300">
                    {formatDecimal(entity.coordinates[0], entity.coordinates[1])}
                  </div>
                  <div className="text-[9px] text-zinc-600 mt-0.5">
                    Last known: {formatDistanceToNow(entity.lastSeen, { addSuffix: true })}
                  </div>
                </div>
                <button
                  onClick={() => flyToEntity(entity)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold tracking-wider rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors shrink-0"
                >
                  <MapPin size={10} />
                  FLY TO MAP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mini Timeline */}
        <MiniTimeline
          events={events.slice(0, 5)}
          totalCount={events.length}
          onViewAll={() => setActiveView('timeline')}
        />

        {/* Mini Relationship Graph */}
        {relationships.length > 0 && (
          <div className="border-t border-white/[0.06] pt-3">
            <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
              <Activity size={10} /> LINK GRAPH
            </h4>
            <MiniRelGraph
              entity={entity}
              relationships={relationships}
              entities={entities}
            />
          </div>
        )}

        {/* Relationships list */}
        {relationships.length > 0 && (
          <div className="border-t border-white/[0.06] pt-3">
            <GlassCard className="!p-3" animate={false}>
              <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
                <Link2 size={10} /> RELATIONSHIPS ({relationships.length})
              </h4>
              <div className="space-y-1.5">
                {relationships.map((rel, i) => {
                  const otherId = rel.from === entity.id ? rel.to : rel.from;
                  return (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-400">{getEntityName(otherId)}</span>
                      <span className="text-zinc-600 font-mono">{rel.type.replace(/_/g, ' ')}</span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        )}

        {/* Timestamps */}
        <div className="border-t border-white/[0.06] pt-3">
          <div className="text-[9px] text-zinc-600 space-y-1 px-1">
            <div>First seen: {format(entity.firstSeen, 'yyyy-MM-dd HH:mm')}</div>
            <div>Last seen: {formatDistanceToNow(entity.lastSeen, { addSuffix: true })}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
