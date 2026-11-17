import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, RotateCcw, RotateCw, Zap } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import PanelState from '../common/PanelState';
import { useCan } from '../../hooks/useCan';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { SectionLabel, ModeChip, QuickBtn, Slider } from './CommandControls';
import { apiFetch } from '../../utils/api';
import { API_BASE, API_CONFIGURED } from '../../utils/runtimeConfig';

const MODES = ['ORBIT', 'GRID', 'WAYPOINT', 'HOLD', 'RTL', 'LAND'];
const MAX_LOG = 5;

function formatCommand(command, params) {
  const detail = Object.entries(params || {})
    .map(([key, value]) => `${key}:${value}`)
    .join(' ');
  return detail ? `${command} ${detail}` : command;
}

export default function DroneCommandPanel() {
  const canOperate = useCan('operator');
  const fleet = useTelemetryStore((s) => s.fleet);
  const activeDroneId = useTelemetryStore((s) => s.activeDroneId);
  const isConnected = useTelemetryStore((s) => s.isConnected);
  const setActiveDroneId = useTelemetryStore((s) => s.setActiveDroneId);

  const [selectedDrone, setSelectedDrone] = useState('');
  const [speed, setSpeed] = useState(5.0);
  const [altitude, setAltitude] = useState(80);
  const [orbitRadius, setOrbitRadius] = useState(600);
  const [commandLog, setCommandLog] = useState([]);
  const [ack, setAck] = useState(null);
  const [ackDetail, setAckDetail] = useState('');
  const [pendingCommand, setPendingCommand] = useState(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [flightTimeSeconds, setFlightTimeSeconds] = useState(0);
  const confirmTimer = useRef(null);

  const droneIds = useMemo(
    () => [...new Set(fleet.filter((d) => typeof d?.drone_id === 'string' && d.drone_id.trim()).map((d) => d.drone_id))],
    [fleet],
  );
  const effectiveDrone = selectedDrone || (droneIds.includes(activeDroneId) ? activeDroneId : droneIds[0]) || '';
  const targetAvailable = droneIds.includes(effectiveDrone);
  const reportedMode = fleet.find((d) => d?.drone_id === effectiveDrone)?.flight_mode;
  const activeMode = typeof reportedMode === 'string' ? reportedMode.toUpperCase() : null;
  const commandReady = API_CONFIGURED && isConnected && targetAvailable;

  useEffect(() => {
    if (targetAvailable) setActiveDroneId(effectiveDrone);
  }, [effectiveDrone, targetAvailable, setActiveDroneId]);

  useEffect(() => {
    clearTimeout(confirmTimer.current);
    const reset = setTimeout(() => setConfirmStop(false), 0);
    return () => {
      clearTimeout(reset);
      clearTimeout(confirmTimer.current);
    };
  }, [effectiveDrone, commandReady]);

  useEffect(() => {
    const id = setInterval(() => setFlightTimeSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const pushLog = useCallback((cmd, status = 'PENDING') => {
    const entry = {
      cmd,
      droneId: effectiveDrone,
      status,
      time: new Date().toISOString().slice(11, 19) + 'Z',
    };
    setCommandLog((prev) => [entry, ...prev].slice(0, MAX_LOG));
  }, [effectiveDrone]);

  const sendCommand = useCallback(async (command, params = {}) => {
    if (!commandReady) {
      setAck('FAILED');
      setAckDetail('Commands unavailable');
      return null;
    }
    const label = formatCommand(command, params);
    setPendingCommand(command);
    setAck('PENDING');
    setAckDetail(`${effectiveDrone}: ${label}`);
    pushLog(label, 'PENDING');
    try {
      const res = await apiFetch(`${API_BASE}/api/drone/${encodeURIComponent(effectiveDrone)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, params }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.success === false) {
        const message = payload.detail || payload.error || `HTTP ${res.status}`;
        throw new Error(message);
      }
      setAck('CONFIRMED');
      setAckDetail(`${effectiveDrone}: ${payload.data?.ack === 'confirmed' ? 'Simulator state updated' : 'Accepted'}`);
      pushLog(label, 'CONFIRMED');
      return payload.data;
    } catch (error) {
      setAck('FAILED');
      setAckDetail(`${effectiveDrone}: ${error.message || 'Command failed'}`);
      pushLog(label, 'FAILED');
      return null;
    } finally {
      setPendingCommand(null);
    }
  }, [commandReady, effectiveDrone, pushLog]);

  const handleMode = useCallback(async (mode) => {
    await sendCommand('set_mode', { mode: mode.toLowerCase() });
  }, [sendCommand]);

  const handleEmergency = useCallback(() => {
    if (!commandReady) return;
    if (confirmStop !== effectiveDrone) {
      setConfirmStop(effectiveDrone);
      confirmTimer.current = setTimeout(() => setConfirmStop(false), 3000);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmStop(false);
    sendCommand('emergency_stop', {});
  }, [confirmStop, effectiveDrone, commandReady, sendCommand]);

  const hh = String(Math.floor(flightTimeSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((flightTimeSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(flightTimeSeconds % 60).padStart(2, '0');
  const lastCmd = commandLog[0] || null;
  const busy = !!pendingCommand;

  if (!canOperate) {
    return (
      <GlassCard className="!p-4">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">DRONE COMMAND</h3>
        <PanelState title="Operator role required" hint="Your account can view telemetry but not command drones." />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="!p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">DRONE COMMAND</h3>
        <select
          value={effectiveDrone}
          onChange={(e) => {
            clearTimeout(confirmTimer.current);
            setConfirmStop(false);
            setSelectedDrone(e.target.value);
          }}
          disabled={droneIds.length === 0 || busy}
          aria-label="Select command target drone"
          className="bg-zinc-900/80 border border-white/[0.08] rounded-lg px-2.5 py-1 text-[11px]
            font-mono text-zinc-300 outline-none focus:border-indigo-500/40 cursor-pointer"
        >
          {!effectiveDrone && <option value="">NO FLEET</option>}
          {effectiveDrone && !targetAvailable && <option value={effectiveDrone}>{effectiveDrone} (UNAVAILABLE)</option>}
          {droneIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>

      {!commandReady && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-300">
          Commands locked until the backend, WebSocket, and a live fleet target are available.
        </div>
      )}

      <div>
        <SectionLabel>FLIGHT MODE</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <ModeChip
              key={m}
              label={m}
              active={activeMode === m}
              disabled={!commandReady || busy}
              onClick={() => handleMode(m)}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>QUICK COMMANDS</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <QuickBtn disabled={!commandReady || busy} icon={ChevronUp} label="ALT +10M" onClick={() => sendCommand('adjust_altitude', { delta: 10 })} />
          <QuickBtn disabled={!commandReady || busy} icon={ChevronDown} label="ALT -10M" onClick={() => sendCommand('adjust_altitude', { delta: -10 })} />
          <QuickBtn disabled={!commandReady || busy} icon={RotateCcw} label="YAW LEFT" onClick={() => sendCommand('adjust_yaw', { delta: -15 })} />
          <QuickBtn disabled={!commandReady || busy} icon={RotateCw} label="YAW RIGHT" onClick={() => sendCommand('adjust_yaw', { delta: 15 })} />
        </div>
        <div className="mt-1.5">
          <QuickBtn
            icon={Zap}
            label={confirmStop === effectiveDrone && commandReady ? 'CONFIRM STOP' : 'EMERGENCY STOP'}
            danger
            disabled={!commandReady || busy}
            onClick={handleEmergency}
          />
        </div>
      </div>

      <div>
        <SectionLabel>MISSION CONTROL</SectionLabel>
        <div className="flex flex-col gap-2">
          <Slider
            disabled={!commandReady || busy}
            label="Speed"
            value={speed}
            min={0}
            max={20}
            step={0.5}
            unit="m/s"
            onChange={setSpeed}
            onCommit={(value) => sendCommand('set_speed', { value })}
          />
          <Slider
            disabled={!commandReady || busy}
            label="Altitude"
            value={altitude}
            min={10}
            max={200}
            step={5}
            unit="m"
            onChange={setAltitude}
            onCommit={(value) => sendCommand('set_altitude', { value })}
          />
          <Slider
            disabled={!commandReady || busy}
            label="Radius"
            value={orbitRadius}
            min={100}
            max={2000}
            step={50}
            unit="m"
            onChange={setOrbitRadius}
            onCommit={(value) => sendCommand('set_orbit_radius', { value })}
          />
        </div>
      </div>

      <div className="border-t border-white/[0.04] pt-3">
        <SectionLabel>STATUS</SectionLabel>
        <div className="space-y-1 text-[10px] font-mono tabular-nums">
          <div className="flex justify-between text-zinc-500">
            <span>LAST CMD</span>
            <AnimatePresence mode="wait">
              {lastCmd && (
                <motion.span
                  key={`${lastCmd.time}-${lastCmd.status}`}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className={lastCmd.status === 'FAILED' ? 'text-red-400' : 'text-zinc-300'}
                >
                  {lastCmd.droneId}: {lastCmd.cmd.slice(0, 28)} @ {lastCmd.time}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>ACK</span>
            <span className={
              ack === 'CONFIRMED'
                ? 'text-emerald-400'
                : ack === 'FAILED'
                  ? 'text-red-400'
                  : 'text-amber-400'
            }>
              {ack ? (ack === 'CONFIRMED' ? 'CONFIRMED' : ack === 'FAILED' ? 'FAILED' : 'PENDING...') : '--'}
            </span>
          </div>
          {ackDetail && (
            <div className="flex justify-between gap-2 text-zinc-500">
              <span>DETAIL</span>
              <span className="text-right text-zinc-400 truncate max-w-[210px]">{ackDetail}</span>
            </div>
          )}
          <div className="flex justify-between text-zinc-500">
            <span>FLIGHT TIME</span>
            <span className="text-zinc-300">{hh}:{mm}:{ss}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
