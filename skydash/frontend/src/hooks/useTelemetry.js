import { useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMapStore } from '../stores/mapStore';

const WS_URL = 'ws://localhost:8001/ws/telemetry';
const HTTP_URL = 'http://localhost:8001/telemetry';
const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 10000;

export function useTelemetry() {
  const updateTelemetry = useTelemetryStore((s) => s.updateTelemetry);
  const setDisconnected = useTelemetryStore((s) => s.setDisconnected);
  const updateDronePosition = useMapStore((s) => s.updateDronePosition);
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const fallbackRef = useRef(null);

  const processData = useCallback((droneData) => {
    // Accept single drone object or pick primary from array
    const data = Array.isArray(droneData) ? droneData[0] : droneData;
    if (!data) return;

    const latency = 0; // WS doesn't have round-trip measurement
    updateTelemetry(data, latency);

    if (data.gps) {
      updateDronePosition(
        data.gps.latitude,
        data.gps.longitude,
        data.altitude,
        data.attitude?.yaw ?? 0
      );
    }

    // Store fleet data for multi-drone views
    if (Array.isArray(droneData) && droneData.length > 1) {
      useTelemetryStore.getState().updateFleet(droneData);
    }
  }, [updateTelemetry, updateDronePosition]);

  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        // Stop HTTP fallback
        if (fallbackRef.current) {
          clearInterval(fallbackRef.current);
          fallbackRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'telemetry') {
            processData(msg.data);
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setDisconnected();
        // Exponential backoff reconnect
        const delay = Math.min(RECONNECT_BASE * Math.pow(2, retryRef.current), RECONNECT_MAX);
        retryRef.current += 1;
        setTimeout(connectWS, delay);
        // Start HTTP fallback while reconnecting
        startHttpFallback();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket not available, use HTTP fallback
      startHttpFallback();
    }
  }, [processData, setDisconnected]);

  const startHttpFallback = useCallback(() => {
    if (fallbackRef.current) return;

    const fetchData = async () => {
      const start = performance.now();
      try {
        const res = await fetch(HTTP_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const latency = Math.round(performance.now() - start);

        // Handle both old format (direct) and new envelope format
        const data = json.data || json;
        if (Array.isArray(data)) {
          processData(data);
          useTelemetryStore.getState().setLatency(latency);
        } else {
          updateTelemetry(data, latency);
          if (data.gps) {
            updateDronePosition(
              data.gps.latitude, data.gps.longitude,
              data.altitude, data.attitude?.yaw ?? 0
            );
          }
        }
      } catch {
        setDisconnected();
      }
    };

    fetchData();
    fallbackRef.current = setInterval(fetchData, 200);
  }, [processData, updateTelemetry, updateDronePosition, setDisconnected]);

  useEffect(() => {
    connectWS();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on cleanup
        wsRef.current.close();
      }
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
      }
    };
  }, [connectWS]);
}
