import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

/** Signed-in user, their server role, and a sign-out button. Hidden when auth is off. */
export default function AccountChip() {
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!authEnabled || !token) return null;
  return (
    <div className="flex items-center gap-2 pl-3 border-l border-white/[0.08]" data-testid="account-chip">
      <div className="text-right leading-tight">
        <div className="text-[11px] font-mono text-zinc-300 max-w-[120px] truncate">{user?.username || 'user'}</div>
        <div className="text-[9px] font-mono tracking-[0.08em] text-zinc-500">{(user?.role || 'unknown').toUpperCase()}</div>
      </div>
      <button
        onClick={logout}
        title="Sign out"
        aria-label="Sign out"
        className="min-h-8 min-w-8 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
      >
        <LogOut size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}
