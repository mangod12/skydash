import { useState, useMemo, useCallback } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';
import {
  generateGeoJSON, generateKML, generateCSV,
  generateDossier, generateMissionBrief, downloadFile,
} from '../../utils/exportGenerators';

const FORMATS = [
  { id: 'geojson', label: 'GeoJSON', ext: '.geojson', mime: 'application/json' },
  { id: 'kml', label: 'KML', ext: '.kml', mime: 'application/vnd.google-earth.kml+xml' },
  { id: 'csv', label: 'CSV', ext: '.csv', mime: 'text/csv' },
  { id: 'dossier', label: 'Dossier', ext: '.txt', mime: 'text/plain' },
  { id: 'brief', label: 'Brief', ext: '.txt', mime: 'text/plain' },
];

const SCOPES = ['all', 'mission', 'selected'];

function scopeLabel(scope, entityCount, mission, selectedEntity) {
  if (scope === 'all') return `All Entities (${entityCount})`;
  if (scope === 'mission') {
    const name = mission?.name || 'None';
    const count = (mission?.entityIds || []).length;
    return `Active Mission: ${name} (${count} entities)`;
  }
  return `Selected Entity: ${selectedEntity?.name || 'None'}`;
}

function buildContent(fmt, scope, allEntities, relationships, events, mission, selectedEntity) {
  const missionEntities = scope === 'mission' && mission
    ? allEntities.filter((e) => (mission.entityIds || []).includes(e.id))
    : [];
  const entities = scope === 'all' ? allEntities
    : scope === 'mission' ? missionEntities
      : selectedEntity ? [selectedEntity] : [];

  if (fmt === 'geojson') return generateGeoJSON(entities);
  if (fmt === 'kml') return generateKML(entities);
  if (fmt === 'csv') return generateCSV(entities, relationships);

  if (fmt === 'dossier') {
    if (!selectedEntity) return null;
    const rels = relationships.filter((r) => r.from === selectedEntity.id || r.to === selectedEntity.id);
    const evts = events.filter((e) => e.entityId === selectedEntity.id).sort((a, b) => b.time - a.time);
    return generateDossier(selectedEntity, rels, evts, allEntities);
  }

  if (fmt === 'brief') {
    if (!mission) return null;
    const notes = mission.notes || [];
    return generateMissionBrief(mission, missionEntities, events, notes);
  }

  return null;
}

function buildFilename(fmt, selectedEntity, mission) {
  const ts = format(new Date(), 'yyyyMMdd-HHmm');
  const ext = FORMATS.find((f) => f.id === fmt)?.ext || '.txt';
  if (fmt === 'dossier' && selectedEntity) {
    return `skydash-dossier-${selectedEntity.name.replace(/\s+/g, '-').toLowerCase()}-${ts}${ext}`;
  }
  if (fmt === 'brief' && mission) {
    return `skydash-brief-${mission.name.replace(/\s+/g, '-').toLowerCase()}-${ts}${ext}`;
  }
  return `skydash-${fmt}-${ts}${ext}`;
}

export default function ReportExport() {
  const entities = useIntelStore((s) => s.entities);
  const relationships = useIntelStore((s) => s.relationships);
  const events = useIntelStore((s) => s.events);
  const selectedEntityId = useIntelStore((s) => s.selectedEntityId);
  const missions = useMissionStore((s) => s.missions);
  const activeMissionId = useMissionStore((s) => s.activeMissionId);

  const [activeFormat, setActiveFormat] = useState('geojson');
  const [scope, setScope] = useState('all');
  const [copied, setCopied] = useState(false);

  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId) || null,
    [entities, selectedEntityId],
  );
  const mission = useMemo(
    () => missions.find((m) => m.id === activeMissionId) || null,
    [missions, activeMissionId],
  );

  const effectiveScope = activeFormat === 'dossier' ? 'selected'
    : activeFormat === 'brief' ? 'mission' : scope;

  const canExport = useMemo(() => {
    if (activeFormat === 'dossier') return !!selectedEntity;
    if (activeFormat === 'brief') return !!mission;
    return true;
  }, [activeFormat, selectedEntity, mission]);

  const contentSize = useMemo(() => {
    const content = buildContent(activeFormat, effectiveScope, entities, relationships, events, mission, selectedEntity);
    if (!content) return 0;
    return new Blob([content]).size;
  }, [activeFormat, effectiveScope, entities, relationships, events, mission, selectedEntity]);

  const handleDownload = useCallback(() => {
    const content = buildContent(activeFormat, effectiveScope, entities, relationships, events, mission, selectedEntity);
    if (!content) return;
    const fmtDef = FORMATS.find((f) => f.id === activeFormat);
    const filename = buildFilename(activeFormat, selectedEntity, mission);
    downloadFile(content, filename, fmtDef.mime);
  }, [activeFormat, effectiveScope, entities, relationships, events, mission, selectedEntity]);

  const handleCopy = useCallback(async () => {
    const content = buildContent(activeFormat, effectiveScope, entities, relationships, events, mission, selectedEntity);
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, [activeFormat, effectiveScope, entities, relationships, events, mission, selectedEntity]);

  const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">EXPORT DATA</h4>
        <span className="text-[9px] font-mono text-zinc-600">{formatSize(contentSize)}</span>
      </div>

      {/* Format pills */}
      <div>
        <span className="text-[9px] font-semibold tracking-[0.12em] text-zinc-600 mb-1.5 block">FORMAT</span>
        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFormat(f.id)}
              className={clsx(
                'px-2.5 py-1 rounded-full text-[9px] font-semibold tracking-wider transition-all',
                activeFormat === f.id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                  : 'bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:bg-white/[0.06]',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scope radios — hidden for locked formats */}
      {activeFormat !== 'dossier' && activeFormat !== 'brief' && (
        <div>
          <span className="text-[9px] font-semibold tracking-[0.12em] text-zinc-600 mb-1.5 block">SCOPE</span>
          <div className="space-y-1">
            {SCOPES.map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer group" onClick={() => setScope(s)}>
                <span className={clsx(
                  'w-3 h-3 rounded-full border-2 flex items-center justify-center transition-colors',
                  scope === s ? 'border-indigo-400' : 'border-zinc-700 group-hover:border-zinc-500',
                )}>
                  {scope === s && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                </span>
                <span className={clsx(
                  'text-[10px] transition-colors',
                  scope === s ? 'text-zinc-300' : 'text-zinc-600',
                  s === 'mission' && !mission && 'opacity-40',
                  s === 'selected' && !selectedEntity && 'opacity-40',
                )}>
                  {scopeLabel(s, entities.length, mission, selectedEntity)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Locked scope hint */}
      {(activeFormat === 'dossier' || activeFormat === 'brief') && (
        <p className="text-[9px] text-zinc-600 italic">
          {activeFormat === 'dossier'
            ? (selectedEntity ? `Entity: ${selectedEntity.name}` : 'Select an entity first')
            : (mission ? `Mission: ${mission.name}` : 'Set an active mission first')}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleDownload}
          disabled={!canExport}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-semibold tracking-wider transition-all',
            canExport
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25'
              : 'bg-white/[0.02] text-zinc-700 border border-white/[0.04] cursor-not-allowed',
          )}
        >
          <Download size={12} />
          DOWNLOAD
        </button>
        <button
          onClick={handleCopy}
          disabled={!canExport}
          className={clsx(
            'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-semibold tracking-wider transition-all',
            canExport
              ? 'bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.08]'
              : 'bg-white/[0.02] text-zinc-700 border border-white/[0.04] cursor-not-allowed',
          )}
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
    </div>
  );
}
