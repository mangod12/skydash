import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TOUR_KEY = 'skydash_tour_completed';

const STEPS = [
  { selector: '[data-tour="dashboard"]', title: 'DASHBOARD', desc: 'Your operational command center. Fleet status, threat overview, and activity feed at a glance.' },
  { selector: '[data-tour="map"]', title: 'MAP VIEW', desc: "God's eye view. Real-time drone positions, entity markers, heatmaps, and spatial search." },
  { selector: '[data-tour="telemetry"]', title: 'TELEMETRY', desc: 'Flight deck instruments. Attitude, altitude, battery, signal — all real-time.' },
  { selector: '[data-tour="intel"]', title: 'INTEL PANEL', desc: 'Intelligence center. Entities, relationships, link analysis, and threat assessment.' },
  { selector: '[data-tour="missions"]', title: 'MISSIONS', desc: 'Investigation workspace. Create missions, link entities, take analyst notes.' },
  { selector: '[data-tour="command-palette"]', title: 'COMMAND PALETTE', desc: 'Press Ctrl+K to search everything — entities, missions, commands.' },
  { selector: '[data-tour="notifications"]', title: 'NOTIFICATIONS', desc: 'Real-time alerts from configurable rules. Click the bell to see all.' },
  { selector: null, title: 'THEME', desc: 'Switch between Midnight, Tactical, and Arctic themes in Settings.' },
];

function getRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 };
}

function clipPath(rect) {
  if (!rect) return 'none';
  const { top, left, width, height } = rect;
  const r = left + width;
  const b = top + height;
  return `polygon(0% 0%, 0% 100%, ${left}px 100%, ${left}px ${top}px, ${r}px ${top}px, ${r}px ${b}px, ${left}px ${b}px, ${left}px 100%, 100% 100%, 100% 0%)`;
}

function tooltipPos(rect) {
  if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const style = {};
  if (cx < window.innerWidth / 2) {
    style.left = rect.left + rect.width + 16;
  } else {
    style.left = rect.left - 320 - 16;
    if (style.left < 12) style.left = 12;
  }
  style.top = Math.max(12, Math.min(cy - 60, window.innerHeight - 220));
  return style;
}

export function startTour() {
  localStorage.removeItem(TOUR_KEY);
  window.dispatchEvent(new CustomEvent('skydash-start-tour'));
}

export default function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  const finish = useCallback(() => {
    localStorage.setItem(TOUR_KEY, 'true');
    setActive(false);
    setStep(0);
  }, []);

  // First-run detection + manual trigger
  useEffect(() => {
    const handleStart = () => { setStep(0); setActive(true); };
    window.addEventListener('skydash-start-tour', handleStart);
    return () => window.removeEventListener('skydash-start-tour', handleStart);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      const timer = setTimeout(() => setActive(true), 2800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Recompute rect on step change or resize
  useEffect(() => {
    if (!active) return;
    const update = () => setRect(getRect(STEPS[step]?.selector));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active, step]);

  const next = () => step < STEPS.length - 1 ? setStep(step + 1) : finish();
  const current = STEPS[step];
  const pos = tooltipPos(rect);

  return (
    <AnimatePresence>
      {active && current && (
        <motion.div
          key="tour-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200]"
        >
          {/* Overlay with cutout */}
          <div
            className="absolute inset-0 transition-[clip-path] duration-500 ease-out"
            style={{ background: 'rgba(0,0,0,0.75)', clipPath: clipPath(rect) }}
            onClick={finish}
          />

          {/* Tooltip */}
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="absolute glass-elevated rounded-xl p-4 max-w-[300px] border border-white/[0.08]"
            style={pos}
          >
            <div className="font-mono text-[9px] text-zinc-500 mb-1">
              {step + 1} OF {STEPS.length}
            </div>
            <div className="text-xs font-bold tracking-[0.15em] text-indigo-400 mb-1.5">
              {current.title}
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed mb-4">
              {current.desc}
            </p>

            <div className="flex items-center justify-between">
              <button
                onClick={finish}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                SKIP TOUR
              </button>
              <button
                onClick={next}
                className="px-3 py-1 text-[11px] font-semibold bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-colors"
              >
                {step < STEPS.length - 1 ? 'NEXT' : 'FINISH'}
              </button>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === step ? 'bg-indigo-400' : i < step ? 'bg-indigo-400/40' : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
