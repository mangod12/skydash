import { useMemo, useCallback } from 'react';
import { X, Printer, Copy, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useMissionStore } from '../../stores/missionStore';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { audit } from '../../stores/auditStore';

const THREAT_ORDER = ['critical', 'high', 'medium', 'low', 'unknown'];
const VERSION = 'SkyDash v2.0';

function threatCounts(entities) {
  const counts = {};
  entities.forEach((e) => { counts[e.threatLevel] = (counts[e.threatLevel] || 0) + 1; });
  return THREAT_ORDER.filter((t) => counts[t]).map((t) => ({ level: t, count: counts[t] }));
}

function buildPlainText(mission, entities, rels, events, fleet, now) {
  const hr = '='.repeat(55), sr = '-'.repeat(55);
  const title = mission?.name || 'General Intelligence Report';
  const status = mission?.status?.toUpperCase() || 'ACTIVE';
  const created = mission?.created_at ? format(new Date(mission.created_at), 'yyyy-MM-dd HH:mm') + 'Z' : format(now, 'yyyy-MM-dd HH:mm') + 'Z';
  const tc = threatCounts(entities);
  const high = entities.filter((e) => e.threatLevel === 'high' || e.threatLevel === 'critical').length;
  const notes = mission?.notes || [];
  let r = `${hr}\n         SKYDASH INTELLIGENCE REPORT\n          CLASSIFIED — UNCLASSIFIED\n${hr}\nMISSION: ${title}\nSTATUS: ${status} | CREATED: ${created}\nANALYST: SkyDash Operator\n${hr}\n\n`;
  r += `1. EXECUTIVE SUMMARY\n${sr}\n   Entities: ${entities.length} | High/Critical: ${high} | Events: ${events.length} | Fleet: ${fleet.length}\n\n`;
  r += `2. ENTITY INVENTORY\n${sr}\n   ${'NAME'.padEnd(22)} ${'TYPE'.padEnd(12)} ${'THREAT'.padEnd(10)} CONFID.\n   ${'—'.repeat(22)} ${'—'.repeat(12)} ${'—'.repeat(10)} ${'—'.repeat(7)}\n`;
  entities.forEach((e) => { r += `   ${e.name.padEnd(22).slice(0, 22)} ${e.type.padEnd(12).slice(0, 12)} ${e.threatLevel.toUpperCase().padEnd(10)} ${e.confidence}%\n`; });
  r += `\n3. THREAT ASSESSMENT\n${sr}\n`;
  tc.forEach((t) => { r += `   ${t.level.toUpperCase().padEnd(12)} ${t.count} entit${t.count === 1 ? 'y' : 'ies'}\n`; });
  r += `\n4. RELATIONSHIP MAP\n${sr}\n`;
  rels.forEach((rel) => { r += `   ${entities.find((e) => e.id === rel.from)?.name || rel.from} --[${rel.type}]--> ${entities.find((e) => e.id === rel.to)?.name || rel.to} (${rel.confidence}%)\n`; });
  if (!rels.length) r += '   No relationships recorded.\n';
  r += `\n5. TIMELINE OF EVENTS\n${sr}\n`;
  events.slice(0, 25).forEach((e) => { r += `   ${format(e.time, 'HH:mm:ss')} [${e.severity.toUpperCase().padEnd(8)}] ${e.description}\n`; });
  r += `\n6. ANALYST NOTES\n${sr}\n`;
  notes.forEach((n) => { r += `   - ${n.content}\n`; });
  if (!notes.length) r += '   No analyst notes.\n';
  r += `\n7. FLEET STATUS\n${sr}\n`;
  fleet.forEach((d) => { r += `   ${d.drone_id || d.id} | ALT ${d.altitude?.toFixed(0) || '—'}m | BAT ${d.battery_voltage?.toFixed(1) || '—'}V | SPD ${d.ground_speed?.toFixed(1) || '—'}m/s\n`; });
  if (!fleet.length) r += '   No fleet data available.\n';
  r += `\n${hr}\nGenerated: ${format(now, "yyyy-MM-dd'T'HH:mm:ss")}Z by ${VERSION}\n${hr}\nEND OF REPORT\n`;
  return r;
}

function useReportData(missionId) {
  const missions = useMissionStore((s) => s.missions);
  const allEntities = useIntelStore((s) => s.entities);
  const allRelationships = useIntelStore((s) => s.relationships);
  const allEvents = useIntelStore((s) => s.events);
  const fleet = useTelemetryStore((s) => s.fleet);

  return useMemo(() => {
    const mission = missionId ? missions.find((m) => m.id === missionId) : null;
    const entityIds = mission?.entityIds;
    const entities = entityIds ? allEntities.filter((e) => entityIds.includes(e.id)) : allEntities;
    const eids = new Set(entities.map((e) => e.id));
    const relationships = allRelationships.filter((r) => eids.has(r.from) || eids.has(r.to));
    const events = allEvents.filter((e) => !e.entityId || eids.has(e.entityId)).sort((a, b) => a.time - b.time);
    return { mission, entities, relationships, events, fleet };
  }, [missionId, missions, allEntities, allRelationships, allEvents, fleet]);
}

export default function ReportGenerator({ open, onClose, missionId }) {
  const { mission, entities, relationships, events, fleet } = useReportData(missionId);
  const now = useMemo(() => new Date(), [open]);
  const title = mission?.name || 'General Intelligence Report';
  const status = mission?.status?.toUpperCase() || 'ACTIVE';
  const created = mission?.created_at ? format(new Date(mission.created_at), 'yyyy-MM-dd HH:mm') + 'Z' : format(now, 'yyyy-MM-dd HH:mm') + 'Z';
  const tc = threatCounts(entities);
  const high = entities.filter((e) => e.threatLevel === 'high' || e.threatLevel === 'critical').length;
  const notes = mission?.notes || [];

  const plainText = useMemo(() => buildPlainText(mission, entities, relationships, events, fleet, now), [mission, entities, relationships, events, fleet, now]);

  const handlePrint = useCallback(() => { window.print(); audit('export', 'export', 'Printed report'); }, []);
  const handleCopy = useCallback(() => { navigator.clipboard.writeText(plainText); audit('export', 'export', 'Copied report to clipboard'); }, [plainText]);
  const handleDownload = useCallback(() => {
    const html = document.getElementById('skydash-report')?.outerHTML || '';
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SkyDash Report</title><style>body{font-family:monospace;background:#fff;color:#000;padding:2rem;max-width:800px;margin:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:4px 8px;text-align:left;font-size:12px}th{background:#e5e7eb}h1,h2,h3{font-family:sans-serif}hr{border-color:#333}</style></head><body>${html}</body></html>`;
    const blob = new Blob([full], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `skydash-report-${format(now, 'yyyyMMdd-HHmm')}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    audit('export', 'export', 'Downloaded HTML report');
  }, [now]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm print:bg-white print:backdrop-blur-none">
      <style>{`@media print{.no-print{display:none!important}.print-report{background:#fff!important;color:#000!important;border:none!important;box-shadow:none!important;backdrop-filter:none!important}.print-report *{color:#000!important;border-color:#333!important}.print-report table th{background:#e5e7eb!important}}`}</style>

      <div className="no-print fixed top-4 right-4 z-[210] flex gap-2">
        {[{ icon: Printer, label: 'PRINT', fn: handlePrint }, { icon: Copy, label: 'COPY', fn: handleCopy }, { icon: Download, label: 'HTML', fn: handleDownload }].map((b) => (
          <button key={b.label} onClick={b.fn} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800/90 border border-white/10 text-zinc-300 text-[10px] font-semibold tracking-wider hover:bg-zinc-700/90 transition-colors">
            <b.icon size={12} /> {b.label}
          </button>
        ))}
        <button onClick={onClose} className="p-2 rounded-lg bg-zinc-800/90 border border-white/10 text-zinc-400 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      <div id="skydash-report" className="print-report w-full max-w-[800px] my-12 mx-4 p-8 rounded-2xl border border-white/[0.08] backdrop-blur-[16px] bg-[rgba(9,9,11,0.85)] shadow-2xl font-mono text-[12px] leading-relaxed text-zinc-300">
        {/* Header */}
        <div className="text-center border-b border-white/10 pb-4 mb-6">
          <h1 className="text-sm font-bold tracking-[0.25em] text-zinc-100">SKYDASH INTELLIGENCE REPORT</h1>
          <p className="text-[10px] tracking-[0.2em] text-zinc-500 mt-1">CLASSIFIED — UNCLASSIFIED</p>
          <div className="mt-3 text-[11px] text-zinc-400 space-y-0.5">
            <p>MISSION: <span className="text-zinc-200 font-semibold">{title}</span></p>
            <p>STATUS: {status} | CREATED: {created}</p>
            <p>ANALYST: SkyDash Operator</p>
          </div>
        </div>

        {/* 1. Executive Summary */}
        <Section n={1} title="EXECUTIVE SUMMARY">
          <p>Tracking <span className="text-cyan-400 print:text-black font-semibold">{entities.length}</span> entities with <span className="text-red-400 print:text-black font-semibold">{high}</span> high/critical threats. <span className="text-cyan-400 print:text-black font-semibold">{events.length}</span> events recorded. Fleet: <span className="text-cyan-400 print:text-black font-semibold">{fleet.length}</span> assets.</p>
        </Section>

        {/* 2. Entity Inventory */}
        <Section n={2} title="ENTITY INVENTORY">
          <table className="w-full text-[11px] border-collapse">
            <thead><tr className="text-left text-[9px] tracking-wider text-zinc-500">
              <th className="border border-white/10 px-2 py-1 bg-white/[0.03]">NAME</th>
              <th className="border border-white/10 px-2 py-1 bg-white/[0.03]">TYPE</th>
              <th className="border border-white/10 px-2 py-1 bg-white/[0.03]">THREAT</th>
              <th className="border border-white/10 px-2 py-1 bg-white/[0.03]">CONFID.</th>
            </tr></thead>
            <tbody>{entities.map((e) => (
              <tr key={e.id} className="hover:bg-white/[0.02]">
                <td className="border border-white/[0.06] px-2 py-1 text-zinc-200">{e.name}</td>
                <td className="border border-white/[0.06] px-2 py-1">{e.type}</td>
                <td className="border border-white/[0.06] px-2 py-1">{e.threatLevel.toUpperCase()}</td>
                <td className="border border-white/[0.06] px-2 py-1 tabular-nums">{e.confidence}%</td>
              </tr>
            ))}</tbody>
          </table>
        </Section>

        {/* 3. Threat Assessment */}
        <Section n={3} title="THREAT ASSESSMENT">
          {tc.map((t) => (
            <p key={t.level}><span className="inline-block w-24 font-semibold">{t.level.toUpperCase()}</span> {t.count} entit{t.count === 1 ? 'y' : 'ies'}</p>
          ))}
        </Section>

        {/* 4. Relationship Map */}
        <Section n={4} title="RELATIONSHIP MAP">
          {relationships.length === 0 && <p className="text-zinc-600">No relationships recorded.</p>}
          {relationships.map((rel, i) => {
            const from = entities.find((e) => e.id === rel.from)?.name || rel.from;
            const to = entities.find((e) => e.id === rel.to)?.name || rel.to;
            return <p key={i}>{from} <span className="text-zinc-500">--[{rel.type}]--&gt;</span> {to} <span className="text-zinc-500">({rel.confidence}%)</span></p>;
          })}
        </Section>

        {/* 5. Timeline */}
        <Section n={5} title="TIMELINE OF EVENTS">
          {events.slice(0, 25).map((e) => (
            <p key={e.id}><span className="text-zinc-500 tabular-nums">{format(e.time, 'HH:mm:ss')}</span> [{e.severity.toUpperCase()}] {e.description}</p>
          ))}
          {events.length === 0 && <p className="text-zinc-600">No events recorded.</p>}
        </Section>

        {/* 6. Analyst Notes */}
        <Section n={6} title="ANALYST NOTES">
          {notes.map((n) => <p key={n.id}>- {n.content}</p>)}
          {notes.length === 0 && <p className="text-zinc-600">No analyst notes.</p>}
        </Section>

        {/* 7. Fleet Status */}
        <Section n={7} title="FLEET STATUS">
          {fleet.map((d) => (
            <p key={d.drone_id || d.id} className="tabular-nums">{d.drone_id || d.id} | ALT {d.altitude?.toFixed(0) ?? '—'}m | BAT {d.battery_voltage?.toFixed(1) ?? '—'}V | SPD {d.ground_speed?.toFixed(1) ?? '—'}m/s</p>
          ))}
          {fleet.length === 0 && <p className="text-zinc-600">No fleet data available.</p>}
        </Section>

        {/* Footer */}
        <div className="border-t border-white/10 pt-4 mt-6 text-center text-[10px] text-zinc-600 tracking-wider">
          Generated: {format(now, "yyyy-MM-dd'T'HH:mm:ss")}Z by {VERSION}
        </div>
      </div>
    </div>
  );
}

function Section({ n, title, children }) {
  return (
    <div className="mb-5">
      <h2 className="text-[11px] font-bold tracking-[0.15em] text-zinc-100 mb-2">{n}. {title}</h2>
      <hr className="border-white/[0.06] mb-2" />
      <div className="pl-2 space-y-0.5">{children}</div>
    </div>
  );
}
