import { Command } from 'cmdk';
import { useUIStore } from '../../stores/uiStore';
import {
  Map, Radio, Brain, Users, Clock, Crosshair,
  Layers, Camera, Target, RotateCcw,
} from 'lucide-react';

const COMMANDS = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: Crosshair, group: 'NAVIGATION', action: 'dashboard' },
  { id: 'map', label: 'Go to Map', icon: Map, group: 'NAVIGATION', action: 'map' },
  { id: 'telemetry', label: 'Go to Telemetry', icon: Radio, group: 'NAVIGATION', action: 'telemetry' },
  { id: 'intel', label: 'Go to Intel', icon: Brain, group: 'NAVIGATION', action: 'intel' },
  { id: 'entities', label: 'View Entities', icon: Users, group: 'NAVIGATION', action: 'entities' },
  { id: 'timeline', label: 'View Timeline', icon: Clock, group: 'NAVIGATION', action: 'timeline' },
  { id: 'layers', label: 'Toggle Map Layers', icon: Layers, group: 'MAP' },
  { id: 'screenshot', label: 'Export Screenshot', icon: Camera, group: 'ACTIONS' },
  { id: 'fly-drone', label: 'Fly to Drone', icon: Target, group: 'MAP' },
  { id: 'reset', label: 'Reset Simulation', icon: RotateCcw, group: 'ACTIONS' },
];

export default function CommandPalette() {
  const { commandPaletteOpen, toggleCommandPalette, setActiveView } = useUIStore();

  if (!commandPaletteOpen) return null;

  const runCommand = (cmd) => {
    if (cmd.action) {
      setActiveView(cmd.action);
    }
    if (cmd.id === 'reset') {
      fetch('http://localhost:8001/reset', { method: 'POST' });
    }
    toggleCommandPalette();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={toggleCommandPalette}
      />

      {/* Palette */}
      <Command
        className="relative w-full max-w-lg bg-zinc-900/95 border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
        onKeyDown={(e) => {
          if (e.key === 'Escape') toggleCommandPalette();
        }}
      >
        <Command.Input
          placeholder="Search commands, entities, locations..."
          className="w-full px-4 py-3.5 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none border-b border-white/[0.06]"
          autoFocus
        />
        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-zinc-600">
            No results found.
          </Command.Empty>

          {['NAVIGATION', 'MAP', 'ACTIONS'].map((group) => (
            <Command.Group key={group} heading={group} className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-zinc-600 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.15em] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2">
              {COMMANDS.filter((c) => c.group === group).map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  value={cmd.label}
                  onSelect={() => runCommand(cmd)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 cursor-pointer data-[selected=true]:bg-indigo-500/10 data-[selected=true]:text-indigo-400 transition-colors"
                >
                  <cmd.icon size={16} strokeWidth={1.5} />
                  <span>{cmd.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
