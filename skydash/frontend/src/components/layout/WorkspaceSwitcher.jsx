import { Crosshair, Brain, Shield } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const WORKSPACES = [
  { id: 'operator', label: 'OPERATOR', icon: Crosshair },
  { id: 'analyst', label: 'ANALYST', icon: Brain },
  { id: 'commander', label: 'COMMANDER', icon: Shield },
];

export default function WorkspaceSwitcher() {
  const workspace = useUIStore((s) => s.workspace);
  const setWorkspace = useUIStore((s) => s.setWorkspace);

  return (
    <div role="group" aria-label="Workspace layout" title="Workspace layout (your account role is shown at top right)" className="flex items-center bg-zinc-900/60 border border-white/[0.06] rounded-lg p-0.5 gap-0.5">
      {WORKSPACES.map(({ id, label, icon: Icon }) => {
        const active = workspace === id;
        return (
          <button
            key={id}
            onClick={() => setWorkspace(id)}
            aria-pressed={active}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors text-[9px] font-semibold tracking-wider ${
              active
                ? 'bg-indigo-500/15 text-indigo-400'
                : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04]'
            }`}
          >
            <Icon size={12} strokeWidth={active ? 2 : 1.5} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
