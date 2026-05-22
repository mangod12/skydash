import IntelPanel from '../intel/IntelPanel';
import EntityDetail from '../intel/EntityDetail';
import TimelineView from '../intel/TimelineView';
import NaturalLanguageQuery from '../intel/NaturalLanguageQuery';
import AnomalyDetector from '../intel/AnomalyDetector';
import ReportExport from '../intel/ReportExport';
import GlassCard from '../common/GlassCard';
import { useIntelStore } from '../../stores/intelStore';

export default function IntelView() {
  const selectedEntityId = useIntelStore((s) => s.selectedEntityId);

  return (
    <div className="h-full flex">
      {/* Left: Entity list */}
      <div className="w-[300px] shrink-0 border-r border-white/[0.06]">
        <IntelPanel />
      </div>

      {/* Center: Timeline + NLQ + Anomaly */}
      <div className="flex-1 min-w-0 border-r border-white/[0.06] flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden">
          <TimelineView />
        </div>

        {/* Bottom tools */}
        <div className="border-t border-white/[0.06] p-3 space-y-3 shrink-0 max-h-[280px] overflow-y-auto">
          <NaturalLanguageQuery />
          <AnomalyDetector />
          <ReportExport />
        </div>
      </div>

      {/* Right: Entity detail (conditional) */}
      {selectedEntityId && (
        <div className="w-[320px] shrink-0">
          <EntityDetail />
        </div>
      )}
    </div>
  );
}
