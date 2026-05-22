import { useState } from 'react';
import { Command } from 'cmdk';
import { formatDistanceToNow } from 'date-fns';
import { useUIStore } from '../../stores/uiStore';
import { useIntelStore } from '../../stores/intelStore';
import { useMissionStore } from '../../stores/missionStore';
import { useMapStore } from '../../stores/mapStore';
import { useAuditStore } from '../../stores/auditStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';
import {
  Map, Radio, Brain, Users, Clock, Crosshair, Layers, Camera, Target,
  RotateCcw, BarChart3, Bell, Settings, ScrollText, Car, User, Building2,
  Wifi, Calendar, MapPin, Compass, Star, Columns,
} from 'lucide-react';
import { startTour } from './OnboardingTour';
import { apiFetch } from '../../utils/api';

const COMMANDS = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: Crosshair, group: 'NAVIGATION', action: 'dashboard' },
  { id: 'map', label: 'Go to Map', icon: Map, group: 'NAVIGATION', action: 'map' },
  { id: 'telemetry', label: 'Go to Telemetry', icon: Radio, group: 'NAVIGATION', action: 'telemetry' },
  { id: 'intel', label: 'Go to Intel', icon: Brain, group: 'NAVIGATION', action: 'intel' },
  { id: 'missions', label: 'Go to Missions', icon: Target, group: 'NAVIGATION', action: 'missions' },
  { id: 'entities', label: 'View Entities', icon: Users, group: 'NAVIGATION', action: 'entities' },
  { id: 'timeline', label: 'View Timeline', icon: Clock, group: 'NAVIGATION', action: 'timeline' },
  { id: 'analytics', label: 'Go to Analytics', icon: BarChart3, group: 'NAVIGATION', action: 'analytics' },
  { id: 'settings', label: 'Go to Settings', icon: Settings, group: 'NAVIGATION', action: 'settings' },
  { id: 'audit', label: 'View Audit Log', icon: ScrollText, group: 'NAVIGATION', action: 'settings' },
  { id: 'notifications', label: 'Toggle Notifications', icon: Bell, group: 'ACTIONS', handler: 'notifications' },
  { id: 'layers', label: 'Toggle Map Layers', icon: Layers, group: 'MAP' },
  { id: 'screenshot', label: 'Export Screenshot', icon: Camera, group: 'ACTIONS' },
  { id: 'fly-drone', label: 'Fly to Drone', icon: Target, group: 'MAP' },
  { id: 'reset', label: 'Reset Simulation', icon: RotateCcw, group: 'ACTIONS' },
  { id: 'tour', label: 'Start Tour', icon: Compass, group: 'ACTIONS', handler: 'tour' },
  { id: 'compare', label: 'Compare Entities', icon: Columns, group: 'ACTIONS', action: 'intel', handler: 'compare' },
  { id: 'create-entity', label: 'Create Entity', icon: Target, group: 'ACTIONS', action: 'intel', handler: 'create-entity' },
];

const ENTITY_ICONS = { vehicle: Car, person: User, building: Building2, device: Wifi, event: Calendar };
const THREAT_COLORS = { critical: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-yellow-500', low: 'bg-emerald-500' };
const SEVERITY_COLORS = { critical: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-cyan-500' };
const STATUS_COLORS = { active: 'text-emerald-400', planning: 'text-cyan-400', complete: 'text-zinc-500' };
const GROUP_HEADING = '[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-zinc-600 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.15em] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2';
const ITEM_BASE = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 cursor-pointer data-[selected=true]:bg-indigo-500/10 data-[selected=true]:text-indigo-400 transition-colors';

const match = (text, q) => text?.toLowerCase().includes(q);
const relTime = (ts) => {
  try { return formatDistanceToNow(typeof ts === 'string' ? new Date(ts) : ts, { addSuffix: true }); }
  catch { return ''; }
};

export default function CommandPalette() {
  const { commandPaletteOpen, toggleCommandPalette, setActiveView } = useUIStore();
  const [query, setQuery] = useState('');

  if (!commandPaletteOpen) return null;

  const q = query.toLowerCase().trim();
  const entities = useIntelStore.getState().entities;
  const events = useIntelStore.getState().events;
  const missions = useMissionStore.getState().missions;
  const annotations = useMapStore.getState().annotations;
  const auditEntries = useAuditStore.getState().entries;
  const allBookmarks = useBookmarkStore.getState().bookmarks;

  const slice = (arr) => arr.slice(0, 5);
  const filteredEntities = slice(q ? entities.filter((e) => match(e.name, q) || match(e.type, q) || e.tags?.some((t) => match(t, q))) : entities);
  const filteredMissions = slice(q ? missions.filter((m) => match(m.name, q) || match(m.description, q)) : missions);
  const filteredEvents = slice(q ? events.filter((e) => match(e.description, q)) : events);
  const filteredAnnotations = slice(q ? annotations.filter((a) => match(a.label, q) || match(a.type, q)) : annotations);
  const filteredAudit = slice(q ? auditEntries.filter((a) => match(a.detail, q)) : auditEntries);
  const filteredBookmarks = slice(q ? allBookmarks.filter((b) => match(b.name, q) || match(b.type, q)) : allBookmarks);

  const close = () => { setQuery(''); toggleCommandPalette(); };
  const nav = (view, before) => { before?.(); setActiveView(view); close(); };
  const applyBookmark = (bk) => {
    useBookmarkStore.getState().setActive(bk.id);
    if (bk.type === 'filter') setActiveView('intel');
    else if (bk.type === 'mapview') {
      setActiveView('map');
      useMapStore.getState().flyTo(bk.config.center, bk.config.zoom);
    }
    close();
  };
  const runCommand = (cmd) => {
    if (cmd.action) setActiveView(cmd.action);
    if (cmd.handler === 'notifications') useUIStore.getState().toggleNotifications();
    if (cmd.handler === 'tour') startTour();
    if (cmd.handler === 'compare') useIntelStore.getState().clearComparison();
    if (cmd.handler === 'create-entity') useUIStore.getState().setEntityCreateOpen(true);
    if (cmd.id === 'reset') apiFetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:8001')}/reset`, { method: 'POST' });
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <Command
        className="relative w-full max-w-lg bg-zinc-900/95 border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
        onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
        shouldFilter={false}
      >
        <Command.Input
          placeholder="Search everything..."
          className="w-full px-4 py-3.5 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none border-b border-white/[0.06]"
          autoFocus
          value={query}
          onValueChange={setQuery}
        />
        <Command.List className="max-h-[360px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-zinc-600">
            No results found.
          </Command.Empty>

          {/* COMMANDS */}
          <Command.Group heading="COMMANDS" className={GROUP_HEADING}>
            {COMMANDS
              .filter((c) => !q || match(c.label, q))
              .slice(0, 5)
              .map((cmd) => (
                <Command.Item key={cmd.id} value={`cmd-${cmd.id}`} onSelect={() => runCommand(cmd)} className={ITEM_BASE}>
                  <cmd.icon size={16} strokeWidth={1.5} />
                  <span>{cmd.label}</span>
                </Command.Item>
              ))}
          </Command.Group>

          {filteredBookmarks.length > 0 && (
            <Command.Group heading="BOOKMARKS" className={GROUP_HEADING}>
              {filteredBookmarks.map((bk) => (
                <Command.Item key={bk.id} value={`bk-${bk.id}`} onSelect={() => applyBookmark(bk)} className={ITEM_BASE}>
                  <Star size={16} strokeWidth={1.5} />
                  <span className="flex-1 truncate">Apply: {bk.name}</span>
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-500">{bk.type}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {filteredEntities.length > 0 && (
            <Command.Group heading="ENTITIES" className={GROUP_HEADING}>
              {filteredEntities.map((ent) => {
                const Icon = ENTITY_ICONS[ent.type] || Users;
                return (
                  <Command.Item key={ent.id} value={`ent-${ent.id}`} onSelect={() => nav('intel', () => useIntelStore.getState().selectEntity(ent.id))} className={ITEM_BASE}>
                    <Icon size={16} strokeWidth={1.5} />
                    <span className="flex-1 truncate">{ent.name}</span>
                    <span className={`w-2 h-2 rounded-full ${THREAT_COLORS[ent.threatLevel] || 'bg-zinc-600'}`} />
                    <span className="font-mono text-xs text-zinc-500">{ent.confidence}%</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          )}
          {filteredMissions.length > 0 && (
            <Command.Group heading="MISSIONS" className={GROUP_HEADING}>
              {filteredMissions.map((m) => (
                <Command.Item key={m.id} value={`mis-${m.id}`} onSelect={() => nav('missions', () => useMissionStore.getState().setActiveMission(m.id))} className={ITEM_BASE}>
                  <Target size={16} strokeWidth={1.5} />
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className={`text-[10px] font-semibold tracking-wider uppercase ${STATUS_COLORS[m.status] || 'text-zinc-500'}`}>
                    {m.status || 'draft'}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          {filteredEvents.length > 0 && (
            <Command.Group heading="EVENTS" className={GROUP_HEADING}>
              {filteredEvents.map((evt) => (
                <Command.Item key={evt.id} value={`evt-${evt.id}`} onSelect={() => nav('intel', () => { if (evt.entityId) useIntelStore.getState().selectEntity(evt.entityId); })} className={ITEM_BASE}>
                  <Clock size={16} strokeWidth={1.5} />
                  <span className="flex-1 truncate">{evt.description}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_COLORS[evt.severity] || 'bg-zinc-600'}`} />
                  <span className="font-mono text-xs text-zinc-500 shrink-0">{relTime(evt.time)}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          {filteredAnnotations.length > 0 && (
            <Command.Group heading="ANNOTATIONS" className={GROUP_HEADING}>
              {filteredAnnotations.map((ann) => (
                <Command.Item key={ann.id} value={`ann-${ann.id}`} onSelect={() => nav('map', () => { if (ann.coordinates) useMapStore.getState().flyTo(ann.coordinates); })} className={ITEM_BASE}>
                  <MapPin size={16} strokeWidth={1.5} />
                  <span className="flex-1 truncate">{ann.label || 'Annotation'}</span>
                  <span className="text-xs text-zinc-500">{ann.type}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          {filteredAudit.length > 0 && (
            <Command.Group heading="AUDIT" className={GROUP_HEADING}>
              {filteredAudit.map((a) => (
                <Command.Item key={a.id} value={`aud-${a.id}`} onSelect={() => nav('settings')} className={ITEM_BASE}>
                  <ScrollText size={16} strokeWidth={1.5} />
                  <span className="flex-1 truncate">{a.detail}</span>
                  <span className="font-mono text-xs text-zinc-500 shrink-0">{relTime(a.timestamp)}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}
