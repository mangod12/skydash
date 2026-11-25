import { useEffect } from 'react';
import { useTelemetryStore } from '../stores/telemetryStore';
import { notify } from '../stores/notificationStore';
import { BACKEND_CONFIGURED } from '../utils/runtimeConfig';
import { formatAge } from '../utils/formatAge';

export const LINK_LOSS_DELAY_MS = 5000;

/**
 * Puts telemetry link loss and recovery in the notification center and audit
 * trail, not only the banner. Loss is raised after the same 5s debounce as the
 * banner, so a quick reconnect raises nothing. Recovery is only reported when
 * a loss was raised. Silent when no backend is configured or the link has
 * never connected (nothing was live to lose).
 */
export function useLinkAlerts() {
  useEffect(() => {
    if (!BACKEND_CONFIGURED) return undefined;
    let timer = null;
    let lostAt = null;
    const unsubscribe = useTelemetryStore.subscribe((state, prev) => {
      if (state.isConnected === prev.isConnected) return;
      if (!state.isConnected) {
        if (!state.hasEverConnected || timer || lostAt != null) return;
        timer = setTimeout(() => {
          timer = null;
          lostAt = Date.now();
          notify({
            type: 'alert', severity: 'critical', title: 'Telemetry link lost',
            message: 'Fleet data on screen is no longer live. Reconnecting automatically.',
          });
        }, LINK_LOSS_DELAY_MS);
        return;
      }
      if (timer) { clearTimeout(timer); timer = null; }
      if (lostAt != null) {
        const down = formatAge(Date.now() - lostAt);
        lostAt = null;
        notify({
          type: 'system', severity: 'info', title: 'Telemetry link restored',
          message: `Live fleet data resumed after ${down}.`,
        });
      }
    });
    return () => { unsubscribe(); if (timer) clearTimeout(timer); };
  }, []);
}
