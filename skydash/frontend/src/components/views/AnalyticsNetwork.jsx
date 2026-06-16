import GlassCard from '../common/GlassCard';

function SectionLabel({ children }) {
  return (
    <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">
      {children}
    </h3>
  );
}

export default function AnalyticsNetwork({ networkSummary, topEntities, fleet }) {
  return (
    <>
      {/* Network Intelligence */}
      <GlassCard>
        <SectionLabel>NETWORK INTELLIGENCE</SectionLabel>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
          <div className="text-center">
            <div className="text-[9px] text-zinc-600 tracking-wider mb-1">NODES</div>
            <div className="text-xl font-mono font-bold text-indigo-400 tabular-nums">{networkSummary.nodeCount}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-zinc-600 tracking-wider mb-1">EDGES</div>
            <div className="text-xl font-mono font-bold text-cyan-400 tabular-nums">{networkSummary.edgeCount}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-zinc-600 tracking-wider mb-1">DENSITY</div>
            <div className="text-xl font-mono font-bold text-amber-400 tabular-nums">{(networkSummary.networkDensity * 100).toFixed(0)}%</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-zinc-600 tracking-wider mb-1">CLUSTERS</div>
            <div className="text-xl font-mono font-bold text-violet-400 tabular-nums">{networkSummary.communityCount}</div>
          </div>
        </div>

        {networkSummary.hubEntities.length > 0 && (
          <div className="mb-3">
            <div className="text-[9px] text-zinc-500 tracking-wider mb-1.5">HUB ENTITIES</div>
            <div className="space-y-1">
              {networkSummary.hubEntities.map((hub) => (
                <div key={hub.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[11px] text-zinc-300">{hub.name}</span>
                  <span className="text-[10px] font-mono text-indigo-400 tabular-nums">{hub.connections} links</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {networkSummary.keyFindings.length > 0 && (
          <div>
            <div className="text-[9px] text-zinc-500 tracking-wider mb-1.5">KEY FINDINGS</div>
            <div className="space-y-1">
              {networkSummary.keyFindings.map((finding, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px] text-zinc-400">
                  <span className="text-cyan-500 mt-0.5 shrink-0">&#9656;</span>
                  <span>{finding}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Top entities + Fleet status */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <GlassCard>
          <SectionLabel>TOP ENTITIES BY ACTIVITY</SectionLabel>
          {topEntities.length > 0 ? (
            <div className="space-y-2">
              {topEntities.map((e, i) => (
                <div key={e.name} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-zinc-600 w-4">{i + 1}.</span>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs text-zinc-300 truncate">{e.name}</span>
                    <div className="flex-1 h-1 rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-indigo-500/60"
                        style={{ width: `${(e.count / topEntities[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 tabular-nums">{e.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-zinc-700 text-[10px] text-center py-6">NO ACTIVITY</div>
          )}
        </GlassCard>

        <GlassCard>
          <SectionLabel>FLEET STATUS</SectionLabel>
          {fleet.length === 0 ? (
            <div className="text-zinc-700 text-[10px] text-center py-6">NO LIVE FLEET</div>
          ) : fleet.map((drone) => (
              <div key={drone.drone_id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-mono text-zinc-300">{drone.drone_id}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums text-zinc-500">
                  <span>{drone.flight_mode}</span>
                  <span className="text-emerald-400">{drone.altitude?.toFixed(0) ?? '--'}m</span>
                  <span>{drone.battery_voltage?.toFixed(1) ?? '--'}V</span>
                  <span>{drone.signal_strength ?? '--'}%</span>
                </div>
              </div>
            ))}
        </GlassCard>
      </div>
    </>
  );
}
