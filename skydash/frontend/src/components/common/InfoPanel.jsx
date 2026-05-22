import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Map, Radio, Brain, BarChart3, Settings, Crosshair } from 'lucide-react';

const SECTIONS = [
  {
    title: 'VIEWS',
    items: [
      { icon: Crosshair, key: 'D', text: 'Dashboard — live map + telemetry side panel' },
      { icon: Map, key: 'M', text: 'Map — fullscreen map with HUD, drone trails, entity markers' },
      { icon: Radio, key: 'T', text: 'Telemetry — attitude indicator, battery, signal, charts' },
      { icon: Brain, key: 'I', text: 'Intel — entity list, timeline, link analysis graph, NLQ, exports' },
      { icon: BarChart3, key: null, text: 'Analytics — stat cards, charts, fleet status (click sidebar)' },
      { icon: Settings, key: null, text: 'Settings — theme picker, connection info, shortcuts' },
    ],
  },
  {
    title: 'MAP TOOLS',
    items: [
      { icon: null, key: null, text: 'Layers — toggle satellite, flight path, grid, ADS-B aircraft' },
      { icon: null, key: null, text: 'Measure — click points on map to measure distance' },
      { icon: null, key: null, text: 'Geofence Circle — click center, then click edge to set radius' },
      { icon: null, key: null, text: 'Geofence Polygon — click vertices, double-click to close shape' },
      { icon: null, key: null, text: 'Fly to Drone — centers map on primary drone' },
      { icon: null, key: null, text: 'Coordinates — click bottom-left to cycle DD/DMS/UTM/MGRS' },
    ],
  },
  {
    title: 'INTEL FEATURES',
    items: [
      { icon: null, key: null, text: 'Entity list — sorted by threat, filterable by type, searchable' },
      { icon: null, key: null, text: 'Link Analysis — force-directed graph of entity relationships' },
      { icon: null, key: null, text: 'Timeline — chronological event log with severity badges' },
      { icon: null, key: null, text: 'NLQ — type "high threat vehicles" to query entities naturally' },
      { icon: null, key: null, text: 'Anomaly Detection — flags telemetry outside 2 std deviations' },
      { icon: null, key: null, text: 'Export — download Report (TXT), GeoJSON, or CSV' },
    ],
  },
  {
    title: 'KEYBOARD SHORTCUTS',
    items: [
      { icon: Keyboard, key: 'Ctrl+K', text: 'Command palette — search and navigate anywhere' },
      { icon: null, key: 'B', text: 'Toggle sidebar expand/collapse' },
      { icon: null, key: '?', text: 'Show keyboard shortcuts overlay' },
      { icon: null, key: 'Esc', text: 'Close any open panel or modal' },
    ],
  },
  {
    title: 'DEMO SCENARIO',
    items: [
      { icon: null, key: null, text: '3 drones: ALPHA-1 (orbit), BRAVO-2 (grid search), CHARLIE-3 (waypoint patrol)' },
      { icon: null, key: null, text: '8 tracked entities: vehicles, persons, buildings, devices, events' },
      { icon: null, key: null, text: 'Live telemetry streaming via WebSocket at 10Hz' },
      { icon: null, key: null, text: 'Scenario: surveillance op around Compound ECHO in San Francisco' },
      { icon: null, key: null, text: 'Active threats: perimeter breach, restricted zone intrusion' },
    ],
  },
];

export default function InfoPanel({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-zinc-900/95 border border-white/[0.1] rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200 tracking-wider">SKYDASH GUIDE</h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">Spatial Intelligence Platform — Quick Reference</p>
              </div>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6 space-y-5" style={{ maxHeight: 'calc(80vh - 60px)' }}>
              {SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-[10px] font-bold tracking-[0.2em] text-indigo-400 mb-2">
                    {section.title}
                  </h3>
                  <div className="space-y-1.5">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 py-1">
                        {item.icon && <item.icon size={13} className="text-zinc-500 mt-0.5 shrink-0" />}
                        {!item.icon && <div className="w-[13px] shrink-0" />}
                        <div className="flex-1 text-[11px] text-zinc-400 leading-relaxed">
                          {item.text}
                        </div>
                        {item.key && (
                          <kbd className="shrink-0 px-2 py-0.5 text-[9px] font-mono bg-white/[0.05] border border-white/[0.1] rounded text-zinc-400">
                            {item.key}
                          </kbd>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
