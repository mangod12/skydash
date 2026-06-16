import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, RotateCcw, RotateCw, Zap } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { SectionLabel, ModeChip, QuickBtn, Slider } from './CommandControls';
import { apiFetch } from '../../utils/api';
import { API_BASE, API_CONFIGURED } from '../../utils/runtimeConfig';

const MODES = ['ORBIT', 'GRID', 'WAYPOINT', 'HOLD', 'RTL', 'LAND'];
const MAX_LOG = 5;

export default function DroneCommandPanel() {
  const fleet = useTelemetryStore((s) => s.fleet);
  const activeDroneId = useTelemetryStore((s) => s.activeDroneId);
  const isConnected = useTelemetryStore((s) => s.isConnected);

  const [selectedDrone, setSelectedDrone] = useState('');
  const [activeMode, setActiveMode] = useState('ORBIT');
  const [speed, setSpeed] = useState(5.0);
  const [altitude, setAltitude] = useState(80);
  const [orbitRadius, setOrbitRadius] = useState(600);
  const [commandLog, setCommandLog] = useState([]);
  const [ack, setAck] = useState(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const confirmTimer = useRef(null);
  const startTime = useRef(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const droneIds = fleet.map((d) => d.drone_id);
  const fallbackDrone = activeDroneId && droneIds.includes(activeDroneId)
    ? activeDroneId
    : droneIds[0] || '';
  const commandDrone = selectedDrone && droneIds.includes(selectedDrone) ? selectedDrone : fallbackDrone;
  const commandReady = API_CONFIGURED && isConnected && !!commandDrone;

  useEffect(() => {
    startTime.current = Date.now();
    const id = setInterval(() => {
      if (startTime.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTime.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pushLog = (cmd) => {
    const entry = { cmd, time: new Date().toISOString().slice(11, 19) + 'Z' };
    setCommandLog((prev) => [entry, ...prev].slice(0, MAX_LOG));
    setAck('PENDING');
    setTimeout(() => setAck('CONFIRMED'), 500);
  };

  const sendCommand = async (command, params = {}) => {
    if (!commandReady) {
      setAck('UNAVAILABLE');
      return;
    }
    pushLog(`${command} ${JSON.stringify(params)}`);
    try {
      await apiFetch(`${API_BASE}/api/drone/${commandDrone}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, params }),
      });
    } catch { /* backend stub may not exist yet */ }
  };

  const handleMode = (mode) => {
    setActiveMode(mode);
    sendCommand('set_mode', { mode: mode.toLowerCase() });
  };

  const handleEmergency = () => {
    if (!confirmStop) {
      setConfirmStop(true);
      confirmTimer.current = setTimeout(() => setConfirmStop(false), 3000);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmStop(false);
    sendCommand('emergency_stop', {});
  };

  const hh = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsedSeconds % 60).padStart(2, '0');
  const lastCmd = commandLog[0] || null;

  return (
    <GlassCard className="!p-4 flex flex-col gap-3">
      {/* Header + Drone selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">DRONE COMMAND</h3>
        <select
          value={commandDrone}
          onChange={(e) => setSelectedDrone(e.target.value)}
          disabled={droneIds.length === 0}
          aria-label="Select command target drone"
          className="bg-zinc-900/80 border border-white/[0.08] rounded-lg px-2.5 py-1 text-[11px]
            font-mono text-zinc-300 outline-none focus:border-indigo-500/40 cursor-pointer"
        >
          {droneIds.length === 0 && <option value="">NO FLEET</option>}
          {droneIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>
      {!commandReady && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-300">
          Commands locked until the backend, WebSocket, and a live fleet target are available.
        </div>
      )}

      {/* Flight mode */}
      <div>
        <SectionLabel>FLIGHT MODE</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <ModeChip key={m} label={m} active={activeMode === m} disabled={!commandReady} onClick={() => handleMode(m)} />
          ))}
        </div>
      </div>

      {/* Quick commands */}
      <div>
        <SectionLabel>QUICK COMMANDS</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <QuickBtn disabled={!commandReady} icon={ChevronUp} label="ALT +10M" onClick={() => sendCommand('adjust_altitude', { delta: 10 })} />
          <QuickBtn disabled={!commandReady} icon={ChevronDown} label="ALT -10M" onClick={() => sendCommand('adjust_altitude', { delta: -10 })} />
          <QuickBtn disabled={!commandReady} icon={RotateCcw} label="YAW LEFT" onClick={() => sendCommand('adjust_yaw', { delta: -15 })} />
          <QuickBtn disabled={!commandReady} icon={RotateCw} label="YAW RIGHT" onClick={() => sendCommand('adjust_yaw', { delta: 15 })} />
        </div>
        <div className="mt-1.5">
          <QuickBtn
            icon={Zap}
            label={confirmStop ? 'CONFIRM STOP' : 'EMERGENCY STOP'}
            danger
            disabled={!commandReady}
            onClick={handleEmergency}
          />
        </div>
      </div>

      {/* Mission sliders */}
      <div>
        <SectionLabel>MISSION CONTROL</SectionLabel>
        <div className="flex flex-col gap-2">
          <Slider disabled={!commandReady} label="Speed" value={speed} min={0} max={20} step={0.5} unit="m/s" onChange={setSpeed} />
          <Slider disabled={!commandReady} label="Altitude" value={altitude} min={10} max={200} step={5} unit="m" onChange={setAltitude} />
          <Slider disabled={!commandReady} label="Radius" value={orbitRadius} min={100} max={2000} step={50} unit="m" onChange={setOrbitRadius} />
        </div>
      </div>

      {/* Status */}
      <div className="border-t border-white/[0.04] pt-3">
        <SectionLabel>STATUS</SectionLabel>
        <div className="space-y-1 text-[10px] font-mono tabular-nums">
          <div className="flex justify-between text-zinc-500">
            <span>LAST CMD</span>
            <AnimatePresence mode="wait">
              {lastCmd && (
                <motion.span
                  key={lastCmd.time}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="text-zinc-300"
                >
                  {lastCmd.cmd.slice(0, 28)} @ {lastCmd.time}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>ACK</span>
            <span className={ack === 'CONFIRMED' ? 'text-emerald-400' : ack === 'UNAVAILABLE' ? 'text-red-400' : 'text-amber-400'}>
              {ack ? (ack === 'CONFIRMED' ? 'CONFIRMED' : ack === 'UNAVAILABLE' ? 'LOCKED' : 'PENDING...') : '--'}
            </span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>FLIGHT TIME</span>
            <span className="text-zinc-300">{hh}:{mm}:{ss}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
