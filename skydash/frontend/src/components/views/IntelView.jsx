import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Clock, GitBranch, Columns, Radar, Grid3x3 } from 'lucide-react';
import { PanelBoundary } from '../common/ErrorBoundary';
import IntelPanel from '../intel/IntelPanel';
import EntityDetail from '../intel/EntityDetail';
import EntityComparison from '../intel/EntityComparison';
import TimelineView from '../intel/TimelineView';
import LinkGraph from '../intel/LinkGraph';
import PatternPanel from '../intel/PatternPanel';
import IntelFeed from '../intel/IntelFeed';
import NaturalLanguageQuery from '../intel/NaturalLanguageQuery';
import AnomalyDetector from '../intel/AnomalyDetector';
import ReportExport from '../intel/ReportExport';
import OsintIngestPanel from '../intel/OsintIngestPanel';
import TagCloud from '../intel/TagCloud';
import ConnectionMatrix from '../intel/ConnectionMatrix';
import { useIntelStore } from '../../stores/intelStore';
import { useUIStore } from '../../stores/uiStore';

const CENTER_TABS = [
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'graph', label: 'Link Analysis', icon: GitBranch },
  { id: 'compare', label: 'Compare', icon: Columns },
  { id: 'patterns', label: 'Patterns', icon: Radar },
  { id: 'matrix', label: 'Matrix', icon: Grid3x3 },
];

export default function IntelView() {
  const selectedEntityId = useIntelStore((s) => s.selectedEntityId);
  const comparedEntities = useIntelStore((s) => s.comparedEntities);
  const setFilterTag = useIntelStore((s) => s.setFilterTag);
  const activeView = useUIStore((s) => s.activeView);
  const [centerTab, setCenterTab] = useState('timeline');

  const handleTagClick = useCallback((tag) => {
    setFilterTag(tag);
  }, [setFilterTag]);

  const handleTabKey = useCallback((event, index) => {
    const last = CENTER_TABS.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setCenterTab(CENTER_TABS[next].id);
    document.getElementById(`intel-tab-${CENTER_TABS[next].id}`)?.focus();
  }, []);

  useEffect(() => {
    if (comparedEntities[0] || comparedEntities[1]) {
      const id = requestAnimationFrame(() => setCenterTab('compare'));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [comparedEntities]);

  useEffect(() => {
    if (activeView === 'timeline') {
      const id = requestAnimationFrame(() => setCenterTab('timeline'));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [activeView]);

  return (
    <div className="h-full flex flex-col md:flex-row overflow-y-auto md:overflow-visible">
      {/* Left: Entity list */}
      <div className="h-[125svh] w-full md:h-auto md:w-[300px] shrink-0 border-b md:border-b-0 md:border-r border-white/[0.06]">
        <PanelBoundary name="Entity List">
          <IntelPanel />
        </PanelBoundary>
      </div>

      {/* Center: Timeline/Graph + NLQ + Anomaly */}
      <div className="h-[90svh] shrink-0 md:h-auto md:shrink md:flex-1 min-w-0 md:border-r border-white/[0.06] flex flex-col">
        {/* Tab switcher */}
        <div className="flex border-b border-white/[0.06] shrink-0" role="tablist" aria-label="Intel analysis views">
          {CENTER_TABS.map((tab, index) => (
            <button
              key={tab.id}
              id={`intel-tab-${tab.id}`}
              role="tab"
              aria-selected={centerTab === tab.id}
              aria-controls={`intel-panel-${tab.id}`}
              tabIndex={centerTab === tab.id ? 0 : -1}
              onKeyDown={(event) => handleTabKey(event, index)}
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
        <div
          id={`intel-panel-${centerTab}`}
          role="tabpanel"
          aria-labelledby={`intel-tab-${centerTab}`}
          className="flex-1 min-h-0 overflow-hidden"
        >
          <PanelBoundary name={centerTab}>
            {centerTab === 'timeline' && <TimelineView />}
            {centerTab === 'graph' && <LinkGraph />}
            {centerTab === 'compare' && <EntityComparison />}
            {centerTab === 'patterns' && <PatternPanel />}
            {centerTab === 'matrix' && <ConnectionMatrix />}
          </PanelBoundary>
        </div>

        {/* Bottom tools */}
        <div className="border-t border-white/[0.06] p-3 space-y-3 shrink-0 max-h-[380px] overflow-y-auto">
          <IntelFeed />
          <TagCloud onTagClick={handleTagClick} />
          <NaturalLanguageQuery />
          <AnomalyDetector />
          <OsintIngestPanel />
          <ReportExport />
        </div>
      </div>

      {/* Right: Entity detail (conditional) */}
      {selectedEntityId && (
        <div className="h-[80svh] w-full md:h-auto md:w-[320px] shrink-0 border-t md:border-t-0 border-white/[0.06]">
          <PanelBoundary name="Entity Detail">
            <EntityDetail />
          </PanelBoundary>
        </div>
      )}
    </div>
  );
}
