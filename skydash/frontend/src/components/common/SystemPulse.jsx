import { useState, useEffect, useRef } from 'react';
import { useTelemetryStore } from '../../stores/telemetryStore';

export default function SystemPulse() {
  const isConnected = useTelemetryStore((s) => s.isConnected);
  const fleet = useTelemetryStore((s) => s.fleet);
  const [msgCount, setMsgCount] = useState(0);
  const [rate, setRate] = useState(0);
  const countRef = useRef(0);
  const totalRef = useRef(0);

  // Count messages per second
  useEffect(() => {
    if (!isConnected) {
      countRef.current = 0;
      return;
    }
    countRef.current++;
    totalRef.current++;
  }, [fleet, isConnected]);

  useEffect(() => {
    const id = setInterval(() => {
      setRate(countRef.current);
      setMsgCount(totalRef.current);
      countRef.current = 0;
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Heartbeat dot */}
      <div className="relative w-2 h-2">
        <div className={`absolute inset-0 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {isConnected && (
          <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
        )}
      </div>
      {/* Data rate */}
      <span className="text-zinc-500 tabular-nums">
        {rate}<span className="text-zinc-700">/s</span>
      </span>
      {/* Total messages */}
      <span className="text-zinc-600 tabular-nums">
        {msgCount.toLocaleString()}<span className="text-zinc-700"> msg</span>
      </span>
    </div>
  );
}
