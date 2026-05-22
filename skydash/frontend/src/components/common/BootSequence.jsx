import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BOOT_LINES = [
  { text: 'SKYDASH SPATIAL INTELLIGENCE v2.0', delay: 0, color: 'text-indigo-400' },
  { text: 'Initializing telemetry subsystem...', delay: 200 },
  { text: 'Connecting to drone network...', delay: 400 },
  { text: 'Loading geospatial layers...', delay: 600 },
  { text: 'Intelligence database online', delay: 800 },
  { text: 'Entity tracker initialized', delay: 950 },
  { text: 'SYSTEM READY', delay: 1200, color: 'text-emerald-400' },
];

export default function BootSequence({ onComplete }) {
  const [visible, setVisible] = useState(true);
  const [lines, setLines] = useState([]);

  useEffect(() => {
    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => {
        setLines((prev) => [...prev, line]);
      }, line.delay);
    });

    setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 2200);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] bg-zinc-950 flex items-center justify-center"
        >
          <div className="max-w-md w-full px-8">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="text-center mb-8"
            >
              <div className="text-3xl font-bold tracking-[0.3em] text-indigo-400 drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                SKYDASH
              </div>
              <div className="text-[10px] tracking-[0.4em] text-zinc-600 mt-2">
                SPATIAL INTELLIGENCE PLATFORM
              </div>
            </motion.div>

            {/* Boot log */}
            <div className="space-y-1.5 font-mono text-[11px]">
              {lines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={line.color || 'text-zinc-500'}
                >
                  <span className="text-zinc-700 mr-2">&gt;</span>
                  {line.text}
                  {i === lines.length - 1 && line.text !== 'SYSTEM READY' && (
                    <span className="animate-pulse ml-1">_</span>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mt-6 h-[2px] bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: 'linear' }}
                className="h-full bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
