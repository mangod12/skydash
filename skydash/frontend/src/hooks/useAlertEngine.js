import { useEffect, useRef } from 'react';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useAlertRulesStore } from '../stores/alertRulesStore';
import { useMapStore } from '../stores/mapStore';
import { useIntelStore } from '../stores/intelStore';
import { notify } from '../stores/notificationStore';
import { evaluateRule } from '../utils/alertEvaluator';

const SEVERITY_TO_TYPE = { info: 'system', warning: 'alert', critical: 'alert' };

/**
 * Global alert engine — subscribes to telemetry store changes,
 * evaluates all enabled rules, and fires notifications respecting cooldowns.
 */
export function useAlertEngine() {
  const prevDataRef = useRef({ data: null, fleet: null });

  useEffect(() => {
    const unsubscribe = useTelemetryStore.subscribe((state) => {
      const { data, fleet } = state;
      if (!data && fleet.length === 0) return;

      // Fleet frames can change while selected-drone timestamps stay the same
      // (or are absent). Ignore connection-only changes, not fresh snapshots.
      const previous = prevDataRef.current;
      if (data === previous.data && fleet === previous.fleet) return;
      prevDataRef.current = { data, fleet };

      const drones = fleet.length > 0 ? fleet : (data ? [data] : []);
      const geofences = useMapStore.getState().geofences;
      const entities = useIntelStore.getState().entities;
      const rules = useAlertRulesStore.getState().rules;
      const now = Date.now();

      for (const rule of rules) {
        if (!rule || !rule.enabled) continue;
        const cooldownMs = Number.isFinite(rule.cooldownMs) && rule.cooldownMs >= 0 ? rule.cooldownMs : 60000;
        const lastTriggered = Number.isFinite(rule.lastTriggered) ? rule.lastTriggered : 0;
        const sinceLastTrigger = now - lastTriggered;
        // A backwards wall-clock correction must not suppress alerts until the old clock catches up.
        if (sinceLastTrigger >= 0 && sinceLastTrigger < cooldownMs) continue;

        for (const drone of drones) {
          const result = evaluateRule(rule, drone, geofences, entities);
          if (!result.triggered) continue;

          useAlertRulesStore.getState().setLastTriggered(rule.id, now);
          notify({
            type: Object.hasOwn(SEVERITY_TO_TYPE, rule.severity) ? SEVERITY_TO_TYPE[rule.severity] : 'alert',
            title: rule.name,
            message: result.message,
            severity: rule.severity,
            location: drone.gps
              ? { lat: drone.gps.latitude, lon: drone.gps.longitude }
              : undefined,
          });
          break; // one notification per rule per cycle
        }
      }
    });

    return unsubscribe;
  }, []);
}
