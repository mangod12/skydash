import { useCallback, useEffect, useState } from 'react';
import GlassCard from './GlassCard';
import PanelState from './PanelState';
import { apiFetch } from '../../utils/api';
import { API_BASE } from '../../utils/runtimeConfig';
import { useAuthStore } from '../../stores/authStore';

const ROLES = ['viewer', 'analyst', 'operator', 'commander'];

/** Commander-only account management: change a role, disable or re-enable an account. */
export default function UserAdmin() {
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const isCommander = authEnabled && me?.role === 'commander';

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE}/api/users`);
      if (!res.ok) throw new Error(String(res.status));
      setUsers((await res.json()).data || []);
      setError(null);
    } catch {
      setError('Could not load accounts');
    }
  }, []);

  useEffect(() => { if (isCommander) load(); }, [isCommander, load]);

  const patch = async (u, body) => {
    setBusy(u.id);
    setError(null);
    try {
      const res = await apiFetch(`${API_BASE}/api/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || String(res.status));
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, ...json.data } : x)));
    } catch (e) {
      setError(e.message || 'Update failed');
    } finally {
      setBusy(null);
    }
  };

  if (!isCommander) return null;

  return (
    <GlassCard animate={false}>
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-3">ACCOUNTS</h3>
      {error && <div role="alert" className="mb-2 text-[11px] text-red-300">{error}</div>}
      {users === null && !error && <PanelState kind="loading" title="Loading accounts" />}
      {users && users.length === 0 && <PanelState title="No accounts" />}
      {users && users.length > 0 && (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-zinc-500 text-[9px] tracking-wider">
              <th className="pb-1.5 font-medium">USER</th>
              <th className="pb-1.5 font-medium">ROLE</th>
              <th className="pb-1.5 font-medium text-right">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id} className="border-t border-white/[0.05]">
                  <td className="py-1.5 font-mono text-zinc-300">
                    {u.username}{self && <span className="ml-1.5 text-[9px] text-zinc-500">YOU</span>}
                  </td>
                  <td className="py-1.5">
                    <select
                      aria-label={`Role for ${u.username}`}
                      value={u.role}
                      disabled={self || busy === u.id}
                      onChange={(e) => patch(u, { role: e.target.value })}
                      className="bg-transparent border border-white/[0.1] rounded px-1.5 py-0.5 text-[11px] font-mono text-zinc-300 disabled:opacity-50"
                    >
                      {ROLES.map((r) => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      disabled={self || busy === u.id}
                      onClick={() => patch(u, { disabled: !u.disabled })}
                      className={`px-2 py-0.5 rounded border text-[10px] font-mono tracking-wide disabled:opacity-40 ${
                        u.disabled
                          ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
                          : 'border-white/[0.12] text-zinc-400 hover:bg-white/[0.05]'
                      }`}
                    >
                      {u.disabled ? 'DISABLED - ENABLE' : 'ACTIVE - DISABLE'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </GlassCard>
  );
}
