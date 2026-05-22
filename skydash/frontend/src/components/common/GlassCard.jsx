import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export default function GlassCard({ children, className, glow, animate = true, ...props }) {
  const Comp = animate ? motion.div : 'div';
  const motionProps = animate ? {
    initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  } : {};

  return (
    <Comp
      className={clsx(
        'rounded-2xl border border-white/[0.08] p-5',
        'backdrop-blur-[16px] bg-[rgba(9,9,11,0.55)]',
        'border-t-white/[0.12]',
        glow && 'shadow-[var(--glow-primary)]',
        className
      )}
      {...motionProps}
      {...props}
    >
      {children}
    </Comp>
  );
}
