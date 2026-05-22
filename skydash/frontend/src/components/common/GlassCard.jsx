import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export default function GlassCard({ children, className, glow, elevated, animate = true, role, 'aria-label': ariaLabel, ...props }) {
  const Comp = animate ? motion.div : 'div';
  const motionProps = animate ? {
    initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  } : {};

  return (
    <Comp
      className={clsx(
        'rounded-2xl p-5',
        elevated ? 'glass-elevated' : [
          'border border-white/[0.08] border-t-white/[0.12]',
          'backdrop-blur-[16px] bg-[rgba(9,9,11,0.55)]',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        ],
        glow && 'shadow-[var(--glow-primary)]',
        className
      )}
      role={role}
      aria-label={ariaLabel}
      {...motionProps}
      {...props}
    >
      {children}
    </Comp>
  );
}
