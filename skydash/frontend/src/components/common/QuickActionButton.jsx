import { motion, AnimatePresence } from 'framer-motion';

export default function QuickActionButton({ action, Icon, x, y, index, hovered, onHover, onClick }) {
  return (
    <motion.div
      className="absolute bottom-3 right-3"
      initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
      animate={{ x, y, opacity: 1, scale: 1 }}
      exit={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
      transition={{
        duration: 0.3,
        delay: index * 0.04,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div className="relative">
        <motion.button
          onClick={() => onClick(action.id)}
          onMouseEnter={() => onHover(action.id)}
          onMouseLeave={() => onHover(null)}
          className="w-11 h-11 rounded-full flex items-center justify-center border border-white/[0.1] backdrop-blur-xl bg-[rgba(9,9,11,0.65)] hover:bg-[rgba(9,9,11,0.85)] shadow-md transition-colors"
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          aria-label={action.label}
        >
          <Icon size={16} strokeWidth={1.5} className={action.color} />
        </motion.button>

        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-[0.08em] bg-zinc-900/95 border border-white/[0.08] text-zinc-300 shadow-lg pointer-events-none"
            >
              {action.label.toUpperCase()}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
