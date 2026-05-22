import { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Maximize2 } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { WIDGET_LABELS } from './DashboardWidgets';
import { useWidgetStore } from '../../stores/widgetStore';

const COLS = 12;
const ROW_H = 48;
const EASE = [0.16, 1, 0.3, 1];

/* ─── Add Widget Picker ────────────────────────────────── */

export function AddWidgetPicker({ onAdd, onClose }) {
  const types = useWidgetStore((s) => s.widgetTypes);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: EASE }}
      className="absolute top-12 right-0 z-50 w-56"
    >
      <GlassCard className="!p-3" animate={false}>
        <span className="text-[9px] font-semibold tracking-[0.15em] text-zinc-500 block mb-2">
          ADD WIDGET
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => { onAdd(type); onClose(); }}
              className="text-[9px] font-mono text-zinc-400 px-2 py-1.5 rounded-lg
                         border border-white/[0.06] hover:border-indigo-500/30
                         hover:bg-indigo-500/10 hover:text-indigo-300
                         transition-all duration-150 text-left"
            >
              {WIDGET_LABELS[type] || type.toUpperCase()}
            </button>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* ─── Resize Handle ────────────────────────────────────── */

export function ResizeHandle({ widgetId, currentW, currentH }) {
  const resizeWidget = useWidgetStore((s) => s.resizeWidget);
  const startRef = useRef(null);

  const onPointerDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY, w: currentW, h: currentH };
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      if (!startRef.current) return;
      const dx = ev.clientX - startRef.current.x;
      const dy = ev.clientY - startRef.current.y;
      const colW = (window.innerWidth - 64) / COLS;
      const newW = Math.round(startRef.current.w + dx / colW);
      const newH = Math.round(startRef.current.h + dy / ROW_H);
      resizeWidget(widgetId, newW, newH);
    };

    const onUp = () => {
      startRef.current = null;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }, [widgetId, currentW, currentH, resizeWidget]);

  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize
                 flex items-center justify-center opacity-0 group-hover:opacity-100
                 transition-opacity"
    >
      <Maximize2 size={10} className="text-zinc-500 rotate-90" />
    </div>
  );
}
