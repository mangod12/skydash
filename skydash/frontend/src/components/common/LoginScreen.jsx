import { useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { BRAND } from '../../brand';
import BrandMark from './BrandMark';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    await login(username.trim(), password);
    setLoading(false);
  }, [username, password, login]);

  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center">
      {/* Ambient grid background */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <form onSubmit={handleSubmit}
        className="relative w-full max-w-sm mx-4 bg-zinc-900/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-10 pb-6 text-center">
          <BrandMark centered className="[&>div:first-child]:text-2xl [&>div:first-child]:tracking-[0.2em]" />
          <p className="mt-3 text-[10px] tracking-[0.12em] text-zinc-600 uppercase">{BRAND.tagline}</p>
        </div>

        {/* Fields */}
        <div className="px-8 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-1.5">USERNAME</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500/40 transition-colors font-mono"
              placeholder="Enter username" autoFocus autoComplete="username" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-1.5">PASSWORD</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500/40 transition-colors font-mono"
              placeholder="Enter password" autoComplete="current-password" />
          </div>

          {error && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-8 pt-6 pb-4">
          <button type="submit" disabled={loading || !username.trim() || !password}
            className="w-full py-2.5 text-[11px] font-semibold tracking-[0.15em] text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors">
            {loading ? 'AUTHENTICATING...' : 'LOGIN'}
          </button>
        </div>

        {/* Hint */}
        <div className="px-8 pb-8 text-center">
          <p className="text-[10px] text-zinc-700 tracking-wider">DEFAULT: admin / admin</p>
        </div>
      </form>
    </div>
  );
}
