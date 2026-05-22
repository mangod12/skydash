import { useCallback } from 'react';
import {
  MapPin, Type, Ruler, Search, ClipboardCopy, Crosshair,
} from 'lucide-react';
import { useMapStore } from '../stores/mapStore';
import { useIntelStore } from '../stores/intelStore';
import { formatDecimal } from '../utils/coordinates';

export default function useMapContextMenu({ show, onMeasureFrom, onSearchRadius }) {
  const addAnnotation = useMapStore((s) => s.addAnnotation);
  const annotations = useMapStore((s) => s.annotations);
  const addEntity = useIntelStore((s) => s.addEntity);

  const openMapMenu = useCallback((e) => {
    e.preventDefault();
    const lat = e.latlng?.lat ?? 0;
    const lng = e.latlng?.lng ?? 0;
    const pinCount = annotations.filter((a) => a.type === 'pin').length;

    const items = [
      {
        label: 'Drop Pin Here',
        icon: MapPin,
        action: () => addAnnotation({
          type: 'pin',
          positions: [[lat, lng]],
          label: String(pinCount + 1),
        }),
      },
      {
        label: 'Add Text Label',
        icon: Type,
        action: () => {
          const text = window.prompt('Label text:');
          if (text) addAnnotation({ type: 'text', positions: [[lat, lng]], label: text });
        },
      },
      {
        label: 'Measure From Here',
        icon: Ruler,
        action: () => onMeasureFrom?.({ lat, lng }),
      },
      {
        label: 'Search Radius (500m)',
        icon: Search,
        action: () => onSearchRadius?.({ lat, lng }),
      },
      { separator: true },
      {
        label: 'Copy Coordinates',
        icon: ClipboardCopy,
        action: () => navigator.clipboard.writeText(formatDecimal(lat, lng)),
      },
      {
        label: 'Create Entity Here',
        icon: Crosshair,
        action: () => {
          const name = window.prompt('Entity name:');
          if (!name) return;
          addEntity({
            type: 'event',
            name,
            coordinates: [lat, lng],
            properties: {},
            confidence: 50,
            source: 'Manual Pin',
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            tags: ['user-created'],
            threatLevel: 'none',
          });
        },
      },
    ];

    show(e.originalEvent?.clientX ?? e.clientX, e.originalEvent?.clientY ?? e.clientY, items);
  }, [show, addAnnotation, addEntity, annotations, onMeasureFrom, onSearchRadius]);

  return openMapMenu;
}
