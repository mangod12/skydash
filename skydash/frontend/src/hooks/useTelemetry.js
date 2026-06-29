import { useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMapStore } from '../stores/mapStore';
import { useAuthStore } from '../stores/authStore';
import { apiFetch } from '../utils/api';
import { API_BASE, API_CONFIGURED, WS_BASE, WS_CONFIGURED } from '../utils/runtimeConfig';

const WS_URL = WS_CONFIGURED ? `${WS_BASE}/ws/telemetry` : '';
const HTTP_URL = API_CONFIGURED ? `${API_BASE}/telemetry` : '';
const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 10000;

export function useTelemetry() {
  const updateTelemetry = useTelemetryStore((s) => s.updateTelemetry);
  const setDisconnected = useTelemetryStore((s) => s.setDisconnected);
  const updateDronePosition = useMapStore((s) => s.updateDronePosition);
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const fallbackRef = useRef(null);
  const connectRef = useRef(null);
  const fallbackFnRef = useRef(null);

  const processData = useCallback((droneData) => {
    const telemetryState = useTelemetryStore.getState();
    const data = Array.isArray(droneData)
      ? droneData.find((d) => d.drone_id === telemetryState.activeDroneId) || droneData[0]
      : droneData;
    if (!data) return;

    updateTelemetry(data, 0);

    if (data.gps) {
      updateDronePosition(
        data.gps.latitude,
        data.gps.longitude,
        data.altitude,
        data.attitude?.yaw ?? 0
      );
    }

    if (Array.isArray(droneData) && droneData.length > 1) telemetryState.updateFleet(droneData);
  }, [updateTelemetry, updateDronePosition]);

  const startHttpFallback = useCallback(() => {
    if (!API_CONFIGURED) return;
    if (fallbackRef.current) return;

    const fetchData = async () => {
      const start = performance.now();
      try {
        const res = await apiFetch(HTTP_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const latency = Math.round(performance.now() - start);
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

  useEffect(() => { fallbackFnRef.current = startHttpFallback; }, [startHttpFallback]);

  const connectWS = useCallback(() => {
    if (!WS_CONFIGURED) {
      fallbackFnRef.current?.();
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const token = useAuthStore.getState().token;
      const wsUrl = token ? `${WS_URL}?token=${token}` : WS_URL;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
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
        const delay = Math.min(RECONNECT_BASE * Math.pow(2, retryRef.current), RECONNECT_MAX);
        retryRef.current += 1;
        setTimeout(() => connectRef.current?.(), delay);
        fallbackFnRef.current?.();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      fallbackFnRef.current?.();
    }
  }, [processData, setDisconnected]);

  useEffect(() => { connectRef.current = connectWS; }, [connectWS]);

  useEffect(() => {
    if (!API_CONFIGURED && !WS_CONFIGURED) {
      setDisconnected();
      return undefined;
    }

    connectWS();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
      }
    };
  }, [connectWS, setDisconnected]);
}
