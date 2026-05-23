import { FileText, ScrollText } from 'lucide-react';
import { useIntelStore } from '../../stores/intelStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { generateBriefing, formatBriefingText } from '../../utils/briefingGenerator';

export default function MissionBriefingTab({ mission }) {
  const entities = useIntelStore((s) => s.entities);
  const telemetryData = useTelemetryStore((s) => s.data);
  const fleet = useTelemetryStore((s) => s.fleet);

  const briefing = generateBriefing(mission, entities, { data: telemetryData, fleet });
  const text = formatBriefingText(briefing);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `briefing-${mission.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] font-semibold tracking-wider hover:bg-indigo-500/25 transition-colors">
          <FileText size={12} /> COPY
        </button>
        <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[10px] font-semibold tracking-wider hover:bg-cyan-500/25 transition-colors">
          <ScrollText size={12} /> DOWNLOAD
        </button>
      </div>
      <pre className="p-4 rounded-xl border border-white/[0.06] bg-zinc-900/60 text-[11px] font-mono text-zinc-300 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[600px] overflow-y-auto custom-scrollbar">
        {text}
      </pre>
    </div>
  );
}
