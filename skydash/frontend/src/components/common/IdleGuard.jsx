import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { idleLimitMs, idleState } from '../../utils/idleTimeout';
import { formatAge } from '../../utils/formatAge';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

/**
 * Signs the user out after a period without input (VITE_IDLE_TIMEOUT_MINUTES,
 * default 15, 0 disables). Only active when authentication is on and someone is
 * signed in. A banner appears for the last minute with a way to stay signed in.
 */
export default function IdleGuard() {
  const token = useAuthStore((s) => s.token);
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const logout = useAuthStore((s) => s.logout);
  const lastActivity = useRef(0);
  const [remaining, setRemaining] = useState(null);
  const limit = idleLimitMs();

  useEffect(() => {
    if (!authEnabled || !token || !limit) return undefined;
    lastActivity.current = Date.now();
    const bump = () => { lastActivity.current = Date.now(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const id = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      const state = idleState(idle, limit);
      if (state === 'expired') {
        logout();
        setRemaining(null);
      } else {
        setRemaining(state === 'warning' ? limit - idle : null);
      }
    }, 1000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(id);
      setRemaining(null);
    };
  }, [authEnabled, token, limit, logout]);

  if (remaining == null) return null;
  return (
    <div
      role="alert"
      className="fixed top-14 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 px-3 py-2 rounded border border-amber-500/30 bg-[#0f1216] text-[11px] font-mono"
    >
      <Clock size={13} className="text-amber-400" />
      <span className="text-amber-300">Signing out for inactivity in {formatAge(remaining)}</span>
      <button
        onClick={() => { lastActivity.current = Date.now(); setRemaining(null); }}
        className="px-2 py-0.5 rounded border border-white/[0.15] text-zinc-200 hover:bg-white/[0.06]"
      >
        STAY SIGNED IN
      </button>
    </div>
  );
}
