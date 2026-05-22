import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MENU_W = 224;
const MENU_ITEM_H = 32;
const SEPARATOR_H = 9;
const PADDING_Y = 8;
const EDGE_MARGIN = 8;

function estimateHeight(items) {
  return items.reduce((h, it) => h + (it.separator ? SEPARATOR_H : MENU_ITEM_H), 0) + PADDING_Y;
}

function clampPosition(x, y, items) {
  const h = estimateHeight(items);
  const maxX = window.innerWidth - MENU_W - EDGE_MARGIN;
  const maxY = window.innerHeight - h - EDGE_MARGIN;
  return { x: Math.min(x, maxX), y: Math.min(y, maxY) };
}

export function useContextMenu() {
  const [menu, setMenu] = useState(null);
  const show = useCallback((x, y, items) => setMenu({ x, y, items }), []);
  const hide = useCallback(() => setMenu(null), []);
  return { menu, show, hide };
}

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const pos = clampPosition(x, y, items);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed z-[9999] w-56 py-1 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl shadow-black/30 overflow-hidden"
        style={{ left: pos.x, top: pos.y }}
      >
        {items.map((item, i) => {
          if (item.separator) {
            return <div key={`sep-${i}`} className="border-t border-white/[0.06] my-1" />;
          }

          return (
            <button
              key={item.label}
              disabled={item.disabled}
              onClick={() => { item.action(); onClose(); }}
              className={`w-full flex items-center gap-2.5 py-2 px-3 text-[11px] transition-colors
                ${item.disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/[0.06] cursor-default'}
                ${item.danger ? 'text-red-400' : 'text-zinc-300'}`}
            >
              {item.icon && (
                <span className={`flex-shrink-0 ${item.danger ? 'text-red-400/70' : 'text-zinc-500'}`}>
                  {typeof item.icon === 'function'
                    ? <item.icon size={14} strokeWidth={1.5} />
                    : item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
