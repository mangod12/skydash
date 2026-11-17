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
const STREAM_TIMEOUT = 5000;

const isDroneRecord = (value) => value !== null && typeof value === 'object'
  && !Array.isArray(value) && typeof value.drone_id === 'string' && value.drone_id.trim();

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
  const socketTimeoutRef = useRef(null);
  const attemptRef = useRef(0);
  const pollRequestRef = useRef(null);

  const stopHttpFallback = useCallback(() => {
    pollingGenerationRef.current += 1;
    clearInterval(fallbackRef.current);
    fallbackRef.current = null;
    const request = pollRequestRef.current;
    pollRequestRef.current = null;
    if (request) {
      clearTimeout(request.timer);
      request.controller.abort();
    }
  }, []);

  const processData = useCallback((droneData) => {
    if (Array.isArray(droneData)) {
      const valid = droneData.filter(isDroneRecord);
      // A truly empty snapshot clears the fleet; malformed records do not.
      if (droneData.length && !valid.length) return false;
      droneData = valid;
    } else if (!isDroneRecord(droneData)) {
      return false;
    }
    const telemetryState = useTelemetryStore.getState();
    // Array messages are complete fleet snapshots, including one or zero drones.
    // Replace membership before selecting data so removed drones cannot linger.
    if (Array.isArray(droneData)) {
      telemetryState.updateFleet(droneData);
      if (droneData.length === 0) useMapStore.getState().clearDronePosition();
    }
    const data = Array.isArray(droneData)
      ? droneData.find((d) => d.drone_id === telemetryState.activeDroneId) || droneData[0]
      : droneData;
    if (!data) return true;

    updateTelemetry(data, 0);

    if (data.gps) {
      updateDronePosition(
        data.gps.latitude,
        data.gps.longitude,
        data.altitude,
        data.attitude?.yaw,
        data.drone_id
      );
    }

    return true;
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
      const request = { controller: new AbortController(), timer: null };
      let timedOut = false;
      pollRequestRef.current = request;
      request.timer = setTimeout(() => {
        if (!live()) return;
        timedOut = true;
        inFlight = false;
        if (pollRequestRef.current === request) pollRequestRef.current = null;
        request.controller.abort();
        setDisconnected();
      }, STREAM_TIMEOUT);
      try {
        const res = await apiFetch(HTTP_URL, { signal: request.controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!live() || timedOut) return;
        const latency = Math.round(performance.now() - start);
        const data = json.data || json;
        if (!processData(data)) throw new Error('Invalid telemetry payload');
        useTelemetryStore.getState().setLatency(latency);
      } catch {
        if (live() && !timedOut) setDisconnected();
      } finally {
        clearTimeout(request.timer);
        if (pollRequestRef.current === request) pollRequestRef.current = null;
        if (!timedOut) inFlight = false;
      }
    };

    fetchData();
    fallbackRef.current = setInterval(fetchData, 200);
  }, [processData, setDisconnected]);

  useEffect(() => { fallbackFnRef.current = startHttpFallback; }, [startHttpFallback]);

  const connectWS = useCallback(() => {
    if (!activeRef.current) return;
    const generation = generationRef.current;
    if (!WS_CONFIGURED) {
      fallbackFnRef.current?.();
      return;
    }
    if (connectingRef.current || wsRef.current?.readyState === WebSocket.OPEN
        || wsRef.current?.readyState === WebSocket.CONNECTING) return;
    connectingRef.current = true;
    const attempt = ++attemptRef.current;
    const live = () => activeRef.current && generationRef.current === generation
      && attemptRef.current === attempt;

    const token = useAuthStore.getState().token;

    // Ticket errors must not downgrade auth by putting a session token in the URL.
    const retryConnection = () => {
      if (!live()) return;
      attemptRef.current += 1;
      clearTimeout(socketTimeoutRef.current);
      socketTimeoutRef.current = null;
      const socket = wsRef.current;
      wsRef.current = null;
      if (socket) {
        socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
        socket.close();
      }
      connectingRef.current = false;
      setDisconnected();
      const delay = Math.min(RECONNECT_BASE * Math.pow(2, retryRef.current), RECONNECT_MAX);
      retryRef.current += 1;
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (activeRef.current && generationRef.current === generation) connectRef.current?.();
      }, delay);
      fallbackFnRef.current?.();
    };

    const armWatchdog = () => {
      clearTimeout(socketTimeoutRef.current);
      socketTimeoutRef.current = setTimeout(retryConnection, STREAM_TIMEOUT);
    };

    const open = (wsUrl) => {
      if (!live()) return;
      connectingRef.current = false;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => {
          if (!live()) return;
          // An open transport is not evidence of fresh telemetry. Keep HTTP
          // fallback until the first valid frame, and time out silent sockets.
          armWatchdog();
        };

        ws.onmessage = (event) => {
          if (!live()) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'telemetry' && processData(msg.data)) {
              retryRef.current = 0;
              armWatchdog();
              stopHttpFallback();
            }
          } catch { /* ignore parse errors */ }
        };

        ws.onclose = retryConnection;

        ws.onerror = retryConnection;
      } catch {
        retryConnection();
      }
    };

    armWatchdog();
    telemetrySocketUrl(WS_URL, API_BASE, token).then(open).catch(retryConnection);
  }, [processData, setDisconnected, stopHttpFallback]);

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
      stopHttpFallback();
      generationRef.current += 1;
      connectingRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      clearTimeout(socketTimeoutRef.current);
      socketTimeoutRef.current = null;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWS, setDisconnected, stopHttpFallback]);
}
