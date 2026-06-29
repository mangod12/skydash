import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, ChevronRight } from 'lucide-react';
import { useConsoleCommands } from '../../hooks/useConsoleCommands';

const MAX_OUTPUT = 200;
const PROMPT = '>';
const SLIDE = { hidden: { y: '100%', opacity: 0 }, visible: { y: 0, opacity: 1 } };
const SPRING = { type: 'spring', damping: 28, stiffness: 340 };

function OutputLine({ line }) {
  const isError = line.startsWith('  Unknown') || line.startsWith('  Usage:') || line.startsWith('  Entity not found');
  const isHeader = line.includes('---') || line.endsWith('STATUS') || line.endsWith('CONSOLE v1.0');
  const isCmd = line.startsWith(PROMPT + ' ');

  let color = 'text-emerald-400/90';
  if (isError) color = 'text-red-400/90';
  else if (isHeader) color = 'text-cyan-400/70';
  else if (isCmd) color = 'text-amber-400/80';

  return <div className={`font-mono text-xs leading-relaxed whitespace-pre ${color}`}>{line}</div>;
}

export default function MiniConsole({ open, onClose }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState(['  SKYDASH CONSOLE v1.0 -- Type "help" for commands']);
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const { execute, getSuggestions } = useConsoleCommands();
  const suggestion = useMemo(() => {
    if (!input.trim()) return '';
    const matches = getSuggestions(input);
    return matches.length === 1 ? matches[0] : '';
  }, [input, getSuggestions]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [output]);

  const appendOutput = useCallback((lines) => {
    setOutput((prev) => [...prev, ...lines].slice(-MAX_OUTPUT));
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    appendOutput([`${PROMPT} ${trimmed}`]);
    setHistory((prev) => [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 50));
    setHistoryIdx(-1);
    const result = execute(trimmed);
    if (result === '__CLEAR__') setOutput([]);
    else if (Array.isArray(result)) appendOutput(result);
    setInput('');
  }, [input, execute, appendOutput]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestion) { setInput(suggestion + ' '); }
      else {
        const matches = getSuggestions(input);
        if (matches.length === 1) setInput(matches[0] + ' ');
        else if (matches.length > 1) appendOutput([`  ${matches.join('  ')}`]);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(idx);
      setInput(history[idx]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx <= 0) { setHistoryIdx(-1); setInput(''); return; }
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      setInput(history[idx]);
      return;
    }
    if (e.key === 'Enter') { handleSubmit(); return; }
    if (e.key === 'Escape') onClose();
  }, [suggestion, getSuggestions, input, history, historyIdx, handleSubmit, onClose, appendOutput]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-[60] flex flex-col"
          style={{ maxHeight: '40vh' }}
          variants={SLIDE}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={SPRING}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-950/98 border-t border-emerald-500/20 backdrop-blur-xl">
            <Terminal size={14} className="text-emerald-500" />
            <span className="text-[10px] font-semibold tracking-[0.15em] text-emerald-500/80 uppercase">Console</span>
            <div className="flex-1" />
            <span className="text-[10px] text-zinc-600 font-mono">ESC to close</span>
            <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition-colors p-0.5">
              <X size={14} />
            </button>
          </div>

          {/* Output */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-2 bg-zinc-950/95 backdrop-blur-xl min-h-0"
            style={{ maxHeight: 'calc(40vh - 72px)' }}
          >
            {output.map((line, i) => (
              <OutputLine key={`${i}-${line.slice(0, 20)}`} line={line} />
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950/98 border-t border-white/[0.04] backdrop-blur-xl">
            <ChevronRight size={14} className="text-emerald-500 shrink-0" />
            <div className="relative flex-1">
              {suggestion && input && (
                <span className="absolute inset-0 font-mono text-sm text-zinc-700 pointer-events-none select-none leading-5">
                  {suggestion}
                </span>
              )}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent font-mono text-sm text-emerald-400 outline-none placeholder:text-zinc-700 caret-emerald-500 leading-5"
                placeholder="Type a command..."
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
