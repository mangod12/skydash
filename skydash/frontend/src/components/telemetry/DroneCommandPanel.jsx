import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, RotateCcw, RotateCw, Zap } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { SectionLabel, ModeChip, QuickBtn, Slider } from './CommandControls';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';
const MODES = ['ORBIT', 'GRID', 'WAYPOINT', 'HOLD', 'RTL', 'LAND'];
const MAX_LOG = 5;

export default function DroneCommandPanel() {
  const fleet = useTelemetryStore((s) => s.fleet);
  const activeDroneId = useTelemetryStore((s) => s.activeDroneId);

  const [selectedDrone, setSelectedDrone] = useState('');
  const [activeMode, setActiveMode] = useState('ORBIT');
  const [speed, setSpeed] = useState(5.0);
  const [altitude, setAltitude] = useState(80);
  const [orbitRadius, setOrbitRadius] = useState(600);
  const [commandLog, setCommandLog] = useState([]);
  const [ack, setAck] = useState(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const confirmTimer = useRef(null);
  const startTime = useRef(Date.now());

  const droneIds = fleet.length > 0
    ? fleet.map((d) => d.drone_id)
    : ['ALPHA-1', 'BRAVO-2', 'CHARLIE-3'];

  useEffect(() => {
    if (!selectedDrone && droneIds.length > 0) {
      setSelectedDrone(activeDroneId || droneIds[0]);
    }
  }, [droneIds, activeDroneId, selectedDrone]);

  const pushLog = useCallback((cmd) => {
    const entry = { cmd, time: new Date().toISOString().slice(11, 19) + 'Z' };
    setCommandLog((prev) => [entry, ...prev].slice(0, MAX_LOG));
    setAck('PENDING');
    setTimeout(() => setAck('CONFIRMED'), 500);
  }, []);

  const sendCommand = useCallback(async (command, params = {}) => {
    pushLog(`${command} ${JSON.stringify(params)}`);
    try {
      await fetch(`${API_BASE}/api/drone/${selectedDrone}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, params }),
      });
    } catch { /* backend stub may not exist yet */ }
  }, [selectedDrone, pushLog]);

  const handleMode = useCallback((mode) => {
    setActiveMode(mode);
    sendCommand('set_mode', { mode: mode.toLowerCase() });
  }, [sendCommand]);

  const handleEmergency = useCallback(() => {
    if (!confirmStop) {
      setConfirmStop(true);
      confirmTimer.current = setTimeout(() => setConfirmStop(false), 3000);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmStop(false);
    sendCommand('emergency_stop', {});
  }, [confirmStop, sendCommand]);

  const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const lastCmd = commandLog[0] || null;

  return (
    <GlassCard className="!p-4 flex flex-col gap-3">
      {/* Header + Drone selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">DRONE COMMAND</h3>
        <select
          value={selectedDrone}
          onChange={(e) => setSelectedDrone(e.target.value)}
          className="bg-zinc-900/80 border border-white/[0.08] rounded-lg px-2.5 py-1 text-[11px]
            font-mono text-zinc-300 outline-none focus:border-indigo-500/40 cursor-pointer"
        >
          {droneIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </div>

      {/* Flight mode */}
      <div>
        <SectionLabel>FLIGHT MODE</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <ModeChip key={m} label={m} active={activeMode === m} onClick={() => handleMode(m)} />
          ))}
        </div>
      </div>

      {/* Quick commands */}
      <div>
        <SectionLabel>QUICK COMMANDS</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <QuickBtn icon={ChevronUp} label="ALT +10M" onClick={() => sendCommand('adjust_altitude', { delta: 10 })} />
          <QuickBtn icon={ChevronDown} label="ALT -10M" onClick={() => sendCommand('adjust_altitude', { delta: -10 })} />
          <QuickBtn icon={RotateCcw} label="YAW LEFT" onClick={() => sendCommand('adjust_yaw', { delta: -15 })} />
          <QuickBtn icon={RotateCw} label="YAW RIGHT" onClick={() => sendCommand('adjust_yaw', { delta: 15 })} />
        </div>
        <div className="mt-1.5">
          <QuickBtn
            icon={Zap}
            label={confirmStop ? 'CONFIRM STOP' : 'EMERGENCY STOP'}
            danger
            onClick={handleEmergency}
          />
        </div>
      </div>

      {/* Mission sliders */}
      <div>
        <SectionLabel>MISSION CONTROL</SectionLabel>
        <div className="flex flex-col gap-2">
          <Slider label="Speed" value={speed} min={0} max={20} step={0.5} unit="m/s" onChange={setSpeed} />
          <Slider label="Altitude" value={altitude} min={10} max={200} step={5} unit="m" onChange={setAltitude} />
          <Slider label="Radius" value={orbitRadius} min={100} max={2000} step={50} unit="m" onChange={setOrbitRadius} />
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
            <span className={ack === 'CONFIRMED' ? 'text-emerald-400' : 'text-amber-400'}>
              {ack ? (ack === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING...') : '--'}
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
