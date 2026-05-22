import { useEffect, useRef } from 'react';
import { useIntelStore } from '../stores/intelStore';
import { useMapStore } from '../stores/mapStore';
import { useMissionStore } from '../stores/missionStore';
import { audit } from '../stores/auditStore';

/**
 * Subscribes to store changes and auto-logs audit entries.
 * Mount once at app root level.
 */
export default function useAuditIntegration() {
  const prevEntities = useRef(null);
  const prevAnnotations = useRef(null);
  const prevMissions = useRef(null);
  const prevMissionEntities = useRef({});

  // Intel: entity additions
  useEffect(() => {
    return useIntelStore.subscribe((state) => {
      const prev = prevEntities.current;
      const curr = state.entities;
      if (prev === null) { prevEntities.current = curr; return; }
      if (curr.length > prev.length) {
        const prevIds = new Set(prev.map((e) => e.id));
        curr.filter((e) => !prevIds.has(e.id)).forEach((e) => {
          audit('create', 'entity', `Created "${e.name}"`, { entityId: e.id });
        });
      }
      prevEntities.current = curr;
    });
  }, []);

  // Map: annotation additions
  useEffect(() => {
    return useMapStore.subscribe((state) => {
      const prev = prevAnnotations.current;
      const curr = state.annotations;
      if (prev === null) { prevAnnotations.current = curr; return; }
      if (curr.length > prev.length) {
        const prevIds = new Set(prev.map((a) => a.id));
        curr.filter((a) => !prevIds.has(a.id)).forEach((a) => {
          audit('annotate', 'map', `Placed ${a.type} #${a.label || a.id.slice(-4)}`);
        });
      } else if (curr.length < prev.length) {
        audit('delete', 'map', `Removed ${prev.length - curr.length} annotation(s)`);
      }
      prevAnnotations.current = curr;
    });
  }, []);

  // Missions: creation and entity linking
  useEffect(() => {
    return useMissionStore.subscribe((state) => {
      const prev = prevMissions.current;
      const curr = state.missions;
      if (prev === null) { prevMissions.current = curr; prevMissionEntities.current = buildEntityMap(curr); return; }

      // New missions
      if (curr.length > prev.length) {
        const prevIds = new Set(prev.map((m) => m.id));
        curr.filter((m) => !prevIds.has(m.id)).forEach((m) => {
          audit('create', 'mission', `Created mission "${m.name}"`, { missionId: m.id });
        });
      }
      // Deleted missions
      if (curr.length < prev.length) {
        const currIds = new Set(curr.map((m) => m.id));
        prev.filter((m) => !currIds.has(m.id)).forEach((m) => {
          audit('delete', 'mission', `Deleted mission "${m.name}"`, { missionId: m.id });
        });
      }

      // Entity link/unlink within missions
      const prevMap = prevMissionEntities.current;
      const currMap = buildEntityMap(curr);
      curr.forEach((m) => {
        const pIds = prevMap[m.id] || [];
        const cIds = m.entityIds || [];
        cIds.filter((id) => !pIds.includes(id)).forEach((id) => {
          audit('link', 'mission', `Linked entity ${id} to "${m.name}"`, { missionId: m.id, entityId: id });
        });
        pIds.filter((id) => !cIds.includes(id)).forEach((id) => {
          audit('unlink', 'mission', `Unlinked entity ${id} from "${m.name}"`, { missionId: m.id, entityId: id });
        });
      });

      prevMissions.current = curr;
      prevMissionEntities.current = currMap;
    });
  }, []);
}

function buildEntityMap(missions) {
  const map = {};
  missions.forEach((m) => { map[m.id] = [...(m.entityIds || [])]; });
  return map;
}
