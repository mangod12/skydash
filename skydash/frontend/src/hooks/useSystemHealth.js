import { useState, useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useIntelStore } from '../stores/intelStore';
import { useAuditStore } from '../stores/auditStore';
import useNotificationStore from '../stores/notificationStore';
import { useMapStore } from '../stores/mapStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001';
const N = 30;

const deriveStatus = (conn, lat, drones) =>
  !conn ? 'error' : (lat > 200 || drones === 0) ? 'degraded' : 'healthy';

export function useSystemHealth() {
  const [latHist, setLatHist] = useState([]);
  const [rateHist, setRateHist] = useState([]);
  const [backendUp, setBackendUp] = useState(null);
  const [start] = useState(() => Date.now());
  const msgRef = useRef(0);
  const prevLenRef = useRef(0);

  const isConnected = useTelemetryStore((s) => s.isConnected);
  const latency = useTelemetryStore((s) => s.latency);
  const fleet = useTelemetryStore((s) => s.fleet);
  const histLen = useTelemetryStore((s) => s.history).length;
  const entities = useIntelStore((s) => s.entities);
  const rels = useIntelStore((s) => s.relationships);
  const events = useIntelStore((s) => s.events);
  const notifs = useNotificationStore((s) => s.notifications);
  const audit = useAuditStore((s) => s.entries);
  const anns = useMapStore((s) => s.annotations);

  useEffect(() => {
    const d = histLen - prevLenRef.current;
    if (d > 0) msgRef.current += d;
    prevLenRef.current = histLen;
  }, [histLen]);

  useEffect(() => {
    const id = setInterval(() => {
      setLatHist((p) => [...p, { v: useTelemetryStore.getState().latency }].slice(-N));
      setRateHist((p) => {
        const r = msgRef.current; msgRef.current = 0;
        return [...p, { v: r }].slice(-N);
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const fetchUp = useCallback(async () => {
    try {
      const r = await fetch(`${API}/health`);
      if (r.ok) setBackendUp((await r.json()).uptime ?? null);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUp();
    const id = setInterval(fetchUp, 15000);
    return () => clearInterval(id);
  }, [fetchUp]);

  const active = fleet.filter((d) => d.is_armed !== false).length || (isConnected ? 1 : 0);

  return {
    status: deriveStatus(isConnected, latency, active),
    ws: { isConnected, latency },
    pipeline: { activeDrones: active, total: fleet.length || (isConnected ? 1 : 0), dataPoints: histLen },
    database: { entities: entities.length, relationships: rels.length, events: events.length },
    memory: {
      historyUsed: histLen, historyMax: 200,
      notifications: notifs.length, notificationsMax: 50,
      audit: audit.length, auditMax: 500,
      annotations: anns.length,
    },
    uptime: { session: Date.now() - start, backend: backendUp },
    latencyHistory: latHist,
    rateHistory: rateHist,
  };
}
