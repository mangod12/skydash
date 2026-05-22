import { useState, useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useIntelStore } from '../stores/intelStore';
import { useAuditStore } from '../stores/auditStore';
import useNotificationStore from '../stores/notificationStore';
import { useMapStore } from '../stores/mapStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';
const HISTORY_SIZE = 30;

function deriveStatus(isConnected, latency, activeDrones) {
  if (!isConnected) return 'error';
  if (latency > 200 || activeDrones === 0) return 'degraded';
  return 'healthy';
}

export function useSystemHealth() {
  const [latencyHistory, setLatencyHistory] = useState([]);
  const [rateHistory, setRateHistory] = useState([]);
  const [backendUptime, setBackendUptime] = useState(null);
  const [sessionStart] = useState(() => Date.now());
  const msgCountRef = useRef(0);
  const prevHistoryLenRef = useRef(0);

  const isConnected = useTelemetryStore((s) => s.isConnected);
  const latency = useTelemetryStore((s) => s.latency);
  const fleet = useTelemetryStore((s) => s.fleet);
  const history = useTelemetryStore((s) => s.history);
  const entities = useIntelStore((s) => s.entities);
  const relationships = useIntelStore((s) => s.relationships);
  const events = useIntelStore((s) => s.events);
  const notifications = useNotificationStore((s) => s.notifications);
  const auditEntries = useAuditStore((s) => s.entries);
  const annotations = useMapStore((s) => s.annotations);

  // Track message rate by detecting history length changes
  const currentLen = history.length;
  useEffect(() => {
    const delta = currentLen - prevHistoryLenRef.current;
    if (delta > 0) msgCountRef.current += delta;
    prevHistoryLenRef.current = currentLen;
  }, [currentLen]);

  // Sample metrics every second
  useEffect(() => {
    const id = setInterval(() => {
      setLatencyHistory((prev) =>
        [...prev, { v: useTelemetryStore.getState().latency }].slice(-HISTORY_SIZE),
      );
      setRateHistory((prev) => {
        const rate = msgCountRef.current;
        msgCountRef.current = 0;
        return [...prev, { v: rate }].slice(-HISTORY_SIZE);
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch backend uptime every 15 seconds
  const fetchUptime = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const json = await res.json();
        setBackendUptime(json.uptime ?? null);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUptime();
    const id = setInterval(fetchUptime, 15000);
    return () => clearInterval(id);
  }, [fetchUptime]);

  const activeDrones = fleet.filter((d) => d.is_armed !== false).length || (isConnected ? 1 : 0);

  return {
    status: deriveStatus(isConnected, latency, activeDrones),
    ws: { isConnected, latency },
    pipeline: { activeDrones, total: fleet.length || (isConnected ? 1 : 0), dataPoints: currentLen },
    database: { entities: entities.length, relationships: relationships.length, events: events.length },
    memory: {
      historyUsed: currentLen, historyMax: 200,
      notifications: notifications.length, notificationsMax: 50,
      audit: auditEntries.length, auditMax: 500,
      annotations: annotations.length,
    },
    uptime: { session: Date.now() - sessionStart, backend: backendUptime },
    latencyHistory,
    rateHistory,
  };
}
