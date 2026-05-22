import { useCallback } from 'react';
import {
  Eye, Map, Crosshair, Link2, ClipboardCopy, FileText, Trash2, Columns,
} from 'lucide-react';
import { useIntelStore } from '../stores/intelStore';
import { useMapStore } from '../stores/mapStore';
import { useUIStore } from '../stores/uiStore';
import { useMissionStore } from '../stores/missionStore';
import { formatDecimal } from '../utils/coordinates';

export default function useEntityContextMenu(show) {
  const selectEntity = useIntelStore((s) => s.selectEntity);
  const deleteEntity = useIntelStore((s) => s.deleteEntity);
  const setComparedEntity = useIntelStore((s) => s.setComparedEntity);
  const flyTo = useMapStore((s) => s.flyTo);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const addEntityToMission = useMissionStore((s) => s.addEntityToMission);
  const getActiveMission = useMissionStore((s) => s.getActiveMission);

  const openEntityMenu = useCallback((x, y, entity) => {
    const coords = entity.coordinates;
    const coordStr = coords ? formatDecimal(coords[0], coords[1]) : 'N/A';

    const items = [
      {
        label: 'View Detail',
        icon: Eye,
        action: () => { selectEntity(entity.id); setActiveView('intel'); },
      },
      {
        label: 'Fly to Map',
        icon: Map,
        action: () => {
          if (coords) flyTo([coords[0], coords[1]], 17);
          setActiveView('map');
        },
      },
      {
        label: 'Add to Mission',
        icon: Crosshair,
        action: () => {
          const mission = getActiveMission();
          if (mission) {
            addEntityToMission(mission.id, entity.id);
          } else {
            window.alert('No active mission. Open Missions view to set one.');
          }
        },
      },
      {
        label: 'Create Relationship',
        icon: Link2,
        action: () => { selectEntity(entity.id); setActiveView('intel'); },
      },
      {
        label: 'Compare with...',
        icon: Columns,
        action: () => { setComparedEntity(0, entity.id); setActiveView('intel'); },
      },
      { separator: true },
      {
        label: 'Copy Coordinates',
        icon: ClipboardCopy,
        action: () => navigator.clipboard.writeText(coordStr),
        disabled: !coords,
      },
      {
        label: 'Export Dossier',
        icon: FileText,
        action: () => {
          const lines = [
            `ENTITY DOSSIER: ${entity.name}`,
            `Type: ${entity.type}`,
            `Threat: ${entity.threatLevel}`,
            `Confidence: ${entity.confidence}%`,
            `Source: ${entity.source}`,
            `Coordinates: ${coordStr}`,
            '',
            'Properties:',
            ...Object.entries(entity.properties || {}).map(([k, v]) => `  ${k}: ${v}`),
          ];
          const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${entity.name.replace(/\s+/g, '_')}_dossier.txt`;
          a.click();
          URL.revokeObjectURL(url);
        },
      },
      { separator: true },
      {
        label: 'Delete Entity',
        icon: Trash2,
        danger: true,
        action: () => {
          if (window.confirm(`Delete "${entity.name}"? This cannot be undone.`)) {
            deleteEntity(entity.id);
          }
        },
      },
    ];

    show(x, y, items);
  }, [show, selectEntity, deleteEntity, setComparedEntity, flyTo, setActiveView, addEntityToMission, getActiveMission]);

  return openEntityMenu;
}
