import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard } from 'lucide-react';

const SHORTCUTS = {
  NAVIGATION: [
    { keys: ['D'], desc: 'Dashboard' },
    { keys: ['M'], desc: 'Map view' },
    { keys: ['T'], desc: 'Telemetry' },
    { keys: ['I'], desc: 'Intel' },
    { keys: ['O'], desc: 'Missions' },
    { keys: ['A'], desc: 'Analytics' },
    { keys: ['N'], desc: 'Notifications' },
  ],
  ACTIONS: [
    { keys: ['Ctrl', 'K'], desc: 'Command palette' },
    { keys: ['B'], desc: 'Toggle sidebar' },
    { keys: ['?'], desc: 'Shortcut overlay' },
    { keys: ['Esc'], desc: 'Close panel' },
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

function ShortcutGroup({ title, items }) {
  return (
    <div>
      <h4 className="text-[9px] font-semibold tracking-wider text-zinc-500 mb-2">{title}</h4>
      <div className="space-y-1.5">
        {items.map((s, i) => (
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
              <h3 className="text-[11px] font-semibold text-zinc-200 tracking-wider mb-5">
                KEYBOARD SHORTCUTS
              </h3>
              <div className="grid grid-cols-2 gap-6">
                {Object.entries(SHORTCUTS).map(([title, items]) => (
                  <ShortcutGroup key={title} title={title} items={items} />
                ))}
              </div>
              <p className="text-[9px] text-zinc-600 mt-5">
                Press <kbd className="px-1.5 py-0.5 font-mono bg-zinc-800 border border-white/[0.08] rounded text-zinc-500">?</kbd> or <kbd className="px-1.5 py-0.5 font-mono bg-zinc-800 border border-white/[0.08] rounded text-zinc-500">Esc</kbd> to close
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
