import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], desc: 'Command Palette' },
  { keys: ['D'], desc: 'Dashboard' },
  { keys: ['M'], desc: 'Map View' },
  { keys: ['T'], desc: 'Telemetry View' },
  { keys: ['I'], desc: 'Intel View' },
  { keys: ['B'], desc: 'Toggle Sidebar' },
  { keys: ['Esc'], desc: 'Close Panel' },
];

export default function KeyboardHelp({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-zinc-900/95 border border-white/[0.1] rounded-2xl p-6 max-w-sm w-full backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-200 tracking-wider">KEYBOARD SHORTCUTS</h3>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs text-zinc-400">{s.desc}</span>
                  <div className="flex gap-1">
                    {s.keys.map((key) => (
                      <kbd
                        key={key}
                        className="px-2 py-0.5 text-[10px] font-mono bg-white/[0.05] border border-white/[0.1] rounded text-zinc-300"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
