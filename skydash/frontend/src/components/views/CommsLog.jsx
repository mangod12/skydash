import { useState, useEffect, useRef } from 'react';
import GlassCard from '../common/GlassCard';

const CALLSIGNS = ['ALPHA-1', 'BRAVO-2', 'CHARLIE-3', 'CONTROL', 'OVERWATCH', 'SENTINEL'];

const TEMPLATES = [
  { type: 'movement', msgs: [
    '{cs} on station, maintaining orbit pattern.',
    '{cs} repositioning to waypoint DELTA.',
    '{cs} altitude change to {alt}m AGL.',
    'CONTROL copies {cs}, continue mission.',
  ]},
  { type: 'contact', msgs: [
    '{cs} reports new contact bearing {brg} degrees.',
    '{cs} visual on POI at grid reference {grid}.',
    'CONTROL, {cs} tracking movement south along main road.',
    '{cs} lost visual on target, last seen heading east.',
  ]},
  { type: 'status', msgs: [
    '{cs} battery at {bat}%, requesting RTB clearance.',
    '{cs} signal strength nominal, all sensors green.',
    'CONTROL confirms area secure, all units report status.',
    '{cs} weather check: visibility {vis}km, winds {wind}kts.',
  ]},
  { type: 'alert', msgs: [
    'ALERT: {cs} detecting RF anomaly on {freq} MHz.',
    '{cs} perimeter sensor triggered, sector {sector}.',
    'CONTROL to all units: elevated threat posture.',
    '{cs} requesting immediate support at current position.',
  ]},
];

const TYPE_COLORS = {
  movement: 'text-cyan-500',
  contact: 'text-amber-400',
  status: 'text-zinc-500',
  alert: 'text-red-400',
};

function randFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateMessage() {
  const template = randFrom(TEMPLATES);
  const cs = randFrom(CALLSIGNS);
  const msg = randFrom(template.msgs)
    .replace('{cs}', cs)
    .replace('{alt}', String(randInt(50, 200)))
    .replace('{brg}', String(randInt(0, 359)))
    .replace('{grid}', `37.${randInt(770, 785)}/-122.${randInt(410, 425)}`)
    .replace('{bat}', String(randInt(15, 85)))
    .replace('{vis}', String(randInt(5, 20)))
    .replace('{wind}', String(randInt(3, 25)))
    .replace('{freq}', String(randInt(2400, 5800)))
    .replace('{sector}', String(randInt(1, 8)));

  return {
    id: `comms-${Date.now()}-${Math.random()}`,
    time: Date.now(),
    callsign: cs,
    type: template.type,
    message: msg,
  };
}

function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export default function CommsLog() {
  const [messages, setMessages] = useState(() =>
    Array.from({ length: 5 }, () => {
      const m = generateMessage();
      m.time = Date.now() - randInt(5000, 60000);
      return m;
    }).sort((a, b) => a.time - b.time),
  );
  const scrollRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessages((prev) => [...prev.slice(-19), generateMessage()]);
    }, randInt(4000, 8000));
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <GlassCard className="!p-3">
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">
        COMMS LOG
      </h3>
      <div
        ref={scrollRef}
        className="h-[200px] overflow-y-auto space-y-0.5 font-mono text-[10px] scrollbar-thin scrollbar-thumb-zinc-800"
      >
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2 py-0.5 hover:bg-white/[0.02] rounded px-1">
            <span className="text-zinc-700 tabular-nums shrink-0">
              {formatTime(m.time)}
            </span>
            <span className={`${TYPE_COLORS[m.type]} shrink-0 w-[70px] truncate`}>
              [{m.callsign}]
            </span>
            <span className="text-zinc-400">{m.message}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
