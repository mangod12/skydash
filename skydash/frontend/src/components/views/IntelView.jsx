import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Clock, GitBranch, Columns, Radar } from 'lucide-react';
import { PanelBoundary } from '../common/ErrorBoundary';
import IntelPanel from '../intel/IntelPanel';
import EntityDetail from '../intel/EntityDetail';
import EntityComparison from '../intel/EntityComparison';
import TimelineView from '../intel/TimelineView';
import LinkGraph from '../intel/LinkGraph';
import PatternPanel from '../intel/PatternPanel';
import NaturalLanguageQuery from '../intel/NaturalLanguageQuery';
import AnomalyDetector from '../intel/AnomalyDetector';
import ReportExport from '../intel/ReportExport';
import TagCloud from '../intel/TagCloud';
import { useIntelStore } from '../../stores/intelStore';
import { useUIStore } from '../../stores/uiStore';

const CENTER_TABS = [
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'graph', label: 'Link Analysis', icon: GitBranch },
  { id: 'compare', label: 'Compare', icon: Columns },
  { id: 'patterns', label: 'Patterns', icon: Radar },
];

export default function IntelView() {
  const selectedEntityId = useIntelStore((s) => s.selectedEntityId);
  const comparedEntities = useIntelStore((s) => s.comparedEntities);
  const setFilterTag = useIntelStore((s) => s.setFilterTag);
  const [centerTab, setCenterTab] = useState('timeline');

  const handleTagClick = useCallback((tag) => {
    setFilterTag(tag);
  }, [setFilterTag]);

  useEffect(() => {
    if (comparedEntities[0] || comparedEntities[1]) setCenterTab('compare');
  }, [comparedEntities]);

  return (
    <div className="h-full flex">
      {/* Left: Entity list */}
      <div className="w-[300px] shrink-0 border-r border-white/[0.06]">
        <PanelBoundary name="Entity List">
          <IntelPanel />
        </PanelBoundary>
      </div>

      {/* Center: Timeline/Graph + NLQ + Anomaly */}
      <div className="flex-1 min-w-0 border-r border-white/[0.06] flex flex-col">
        {/* Tab switcher */}
        <div className="flex border-b border-white/[0.06] shrink-0">
          {CENTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCenterTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-[10px] font-semibold tracking-[0.1em] transition-colors',
                centerTab === tab.id
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-zinc-600 hover:text-zinc-400',
              )}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <PanelBoundary name={centerTab}>
            {centerTab === 'timeline' && <TimelineView />}
            {centerTab === 'graph' && <LinkGraph />}
            {centerTab === 'compare' && <EntityComparison />}
            {centerTab === 'patterns' && <PatternPanel />}
          </PanelBoundary>
        </div>

        {/* Bottom tools */}
        <div className="border-t border-white/[0.06] p-3 space-y-3 shrink-0 max-h-[280px] overflow-y-auto">
          <TagCloud onTagClick={handleTagClick} />
          <NaturalLanguageQuery />
          <AnomalyDetector />
          <ReportExport />
        </div>
      </div>

      {/* Right: Entity detail (conditional) */}
      {selectedEntityId && (
        <div className="w-[320px] shrink-0">
          <PanelBoundary name="Entity Detail">
            <EntityDetail />
          </PanelBoundary>
        </div>
      )}
    </div>
  );
}
