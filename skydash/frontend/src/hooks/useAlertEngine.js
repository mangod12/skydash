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
  const prevDataRef = useRef(null);

  useEffect(() => {
    const unsubscribe = useTelemetryStore.subscribe((state) => {
      const { data, fleet } = state;
      if (!data && fleet.length === 0) return;

      // Avoid re-evaluating identical data
      const dataId = data?.timestamp;
      if (dataId === prevDataRef.current) return;
      prevDataRef.current = dataId;

      const drones = fleet.length > 0 ? fleet : (data ? [data] : []);
      const geofences = useMapStore.getState().geofences;
      const entities = useIntelStore.getState().entities;
      const rules = useAlertRulesStore.getState().rules;
      const now = Date.now();

      for (const rule of rules) {
        if (!rule.enabled) continue;
        const sinceLastTrigger = now - rule.lastTriggered;
        if (sinceLastTrigger < rule.cooldownMs) continue;

        for (const drone of drones) {
          const result = evaluateRule(rule, drone, geofences, entities);
          if (!result.triggered) continue;

          useAlertRulesStore.getState().setLastTriggered(rule.id, now);
          notify({
            type: SEVERITY_TO_TYPE[rule.severity] || 'alert',
            title: rule.name,
            message: result.message,
            severity: rule.severity,
          });
          break; // one notification per rule per cycle
        }
      }
    });

    return unsubscribe;
  }, []);
}
