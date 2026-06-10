import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, Search, Copy, Check } from 'lucide-react';

const SHORTCUTS = {
  NAVIGATION: [
    { keys: ['D'], desc: 'Dashboard', category: 'view' },
    { keys: ['M'], desc: 'Map view', category: 'view' },
    { keys: ['T'], desc: 'Telemetry', category: 'view' },
    { keys: ['I'], desc: 'Intel', category: 'view' },
    { keys: ['O'], desc: 'Missions', category: 'view' },
    { keys: ['A'], desc: 'Analytics', category: 'view' },
    { keys: ['N'], desc: 'Notifications', category: 'panel' },
  ],
  ACTIONS: [
    { keys: ['Ctrl', 'K'], desc: 'Command palette', category: 'tool' },
    { keys: ['B'], desc: 'Toggle sidebar', category: 'ui' },
    { keys: ['?'], desc: 'Shortcut overlay', category: 'help' },
    { keys: ['Esc'], desc: 'Close panel', category: 'ui' },
    { keys: ['`'], desc: 'Toggle console', category: 'tool' },
  ],
  MAP: [
    { keys: ['Scroll'], desc: 'Zoom in/out', category: 'map' },
    { keys: ['Click + Drag'], desc: 'Pan map', category: 'map' },
    { keys: ['Click'], desc: 'Select entity/drone', category: 'map' },
    { keys: ['Right Click'], desc: 'Context menu', category: 'map' },
  ],
  TELEMETRY: [
    { keys: ['Click Drone'], desc: 'Switch active drone', category: 'telemetry' },
    { keys: ['Hover Chart'], desc: 'Show data point', category: 'telemetry' },
  ],
};

function KeyBadge({ keys }) {
  return keys.map((k) => (
    <kbd
      key={k}
      className="px-2 py-1 text-[10px] font-mono bg-zinc-800 border border-white/[0.1] rounded text-indigo-400 shadow-sm"
    >
      {k}
    </kbd>
  ));
}

function ShortcutGroup({ title, items, filter }) {
  const filtered = filter
    ? items.filter((s) =>
        s.desc.toLowerCase().includes(filter.toLowerCase()) ||
        s.keys.some((k) => k.toLowerCase().includes(filter.toLowerCase()))
      )
    : items;

  if (filtered.length === 0) return null;

  return (
    <div>
      <h4 className="text-[9px] font-semibold tracking-wider text-zinc-500 mb-2">{title}</h4>
      <div className="space-y-1.5">
        {filtered.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex gap-1"><KeyBadge keys={s.keys} /></div>
            <span className="text-[11px] text-zinc-400">{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KeyboardHelp({ open, onClose, onOpen }) {
  const [inputFocused, setInputFocused] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onFocus = (e) => {
      setInputFocused(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    };
    const onBlur = () => setInputFocused(false);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, []);

  // Reset search when opening/closing
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const allShortcuts = useMemo(() => {
    const all = [];
    Object.entries(SHORTCUTS).forEach(([group, items]) => {
      items.forEach((s) => all.push({ ...s, group }));
    });
    return all;
  }, []);

  const handleCopyShortcuts = useCallback(async () => {
    const text = Object.entries(SHORTCUTS)
      .map(([group, items]) =>
        `## ${group}\n${items.map((s) => `${s.keys.join(' + ')} — ${s.desc}`).join('\n')}`
      )
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, []);

  return (
    <>
      {/* Compact HUD pill */}
      <AnimatePresence>
        {!open && !inputFocused && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0, y: 8 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            onClick={() => onOpen?.()}
            className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5
              bg-zinc-900/40 hover:bg-zinc-900/80 border border-white/[0.06]
              rounded-full cursor-pointer transition-colors"
          >
            <Keyboard size={11} className="text-zinc-400" />
            <span className="text-[9px] font-semibold tracking-wider text-zinc-400">KEYS</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Full overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 12 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="relative bg-zinc-900/95 border border-white/[0.1] rounded-2xl
                p-6 max-w-lg w-full backdrop-blur-xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-semibold text-zinc-200 tracking-wider">
                  KEYBOARD SHORTCUTS
                </h3>
                <button
                  onClick={handleCopyShortcuts}
                  className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono text-zinc-500 
                    hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] rounded transition-colors"
                >
                  {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  {copied ? 'COPIED' : 'COPY ALL'}
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Search shortcuts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-white/[0.03] border border-white/[0.06] 
                    rounded-lg text-zinc-300 placeholder:text-zinc-700 outline-none 
                    focus:border-indigo-500/30 transition-colors"
                  autoFocus
                />
              </div>

              {/* Shortcut groups */}
              <div className="grid grid-cols-2 gap-6 max-h-[400px] overflow-y-auto">
                {Object.entries(SHORTCUTS).map(([title, items]) => (
                  <ShortcutGroup key={title} title={title} items={items} filter={search} />
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-5">
                <p className="text-[9px] text-zinc-600">
                  Press <kbd className="px-1.5 py-0.5 font-mono bg-zinc-800 border border-white/[0.08] rounded text-zinc-500">?</kbd> or <kbd className="px-1.5 py-0.5 font-mono bg-zinc-800 border border-white/[0.08] rounded text-zinc-500">Esc</kbd> to close
                </p>
                <span className="text-[9px] text-zinc-700">
                  {allShortcuts.length} shortcuts
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
