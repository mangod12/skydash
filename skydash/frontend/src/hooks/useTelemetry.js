import { useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMapStore } from '../stores/mapStore';
import { useAuthStore } from '../stores/authStore';
import { apiFetch } from '../utils/api';
import { telemetrySocketUrl } from '../utils/telemetrySocketUrl';
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
  const generationRef = useRef(0);
  const activeRef = useRef(false);
  const connectingRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const pollingGenerationRef = useRef(0);

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
    if (!activeRef.current || !API_CONFIGURED) return;
    if (fallbackRef.current) return;

    const generation = generationRef.current;
    const pollGeneration = ++pollingGenerationRef.current;
    const live = () => activeRef.current && generationRef.current === generation
      && pollingGenerationRef.current === pollGeneration;
    let inFlight = false;
    const fetchData = async () => {
      if (!live() || inFlight) return;
      inFlight = true;
      const start = performance.now();
      try {
        const res = await apiFetch(HTTP_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!live()) return;
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
        if (live()) setDisconnected();
      } finally {
        inFlight = false;
      }
    };

    fetchData();
    fallbackRef.current = setInterval(fetchData, 200);
  }, [processData, updateTelemetry, updateDronePosition, setDisconnected]);

  useEffect(() => { fallbackFnRef.current = startHttpFallback; }, [startHttpFallback]);

  const connectWS = useCallback(() => {
    if (!activeRef.current) return;
    const generation = generationRef.current;
    const live = () => activeRef.current && generationRef.current === generation;
    if (!WS_CONFIGURED) {
      fallbackFnRef.current?.();
      return;
    }
    if (connectingRef.current || wsRef.current?.readyState === WebSocket.OPEN
        || wsRef.current?.readyState === WebSocket.CONNECTING) return;
    connectingRef.current = true;

    const token = useAuthStore.getState().token;

    // Ticket errors must not downgrade auth by putting a session token in the URL.
    const retryConnection = () => {
      if (!live()) return;
      connectingRef.current = false;
      setDisconnected();
      const delay = Math.min(RECONNECT_BASE * Math.pow(2, retryRef.current), RECONNECT_MAX);
      retryRef.current += 1;
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (live()) connectRef.current?.();
      }, delay);
      fallbackFnRef.current?.();
    };

    const open = (wsUrl) => {
      if (!live()) return;
      connectingRef.current = false;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => {
          if (!live()) return;
          retryRef.current = 0;
          pollingGenerationRef.current += 1;
          if (fallbackRef.current) {
            clearInterval(fallbackRef.current);
            fallbackRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          if (!live()) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'telemetry') {
              processData(msg.data);
            }
          } catch { /* ignore parse errors */ }
        };

        ws.onclose = retryConnection;

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        retryConnection();
      }
    };

    telemetrySocketUrl(WS_URL, API_BASE, token).then(open).catch(retryConnection);
  }, [processData, setDisconnected]);

  useEffect(() => { connectRef.current = connectWS; }, [connectWS]);

  useEffect(() => {
    activeRef.current = true;
    generationRef.current += 1;
    if (!API_CONFIGURED && !WS_CONFIGURED) {
      setDisconnected();
      return undefined;
    }

    connectWS();

    return () => {
      activeRef.current = false;
      pollingGenerationRef.current += 1;
      generationRef.current += 1;
      connectingRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
        fallbackRef.current = null;
      }
    };
  }, [connectWS, setDisconnected]);
}
