import { lazy, Suspense } from 'react';
import Shell from './components/layout/Shell';
import DashboardView from './components/views/DashboardView';
import FullMapView from './components/views/FullMapView';
import IntelView from './components/views/IntelView';
import { useUIStore } from './stores/uiStore';

const TelemetryView = lazy(() => import('./components/views/TelemetryView'));
const AnalyticsView = lazy(() => import('./components/views/AnalyticsView'));
const MissionView = lazy(() => import('./components/views/MissionView'));
const SettingsView = lazy(() => import('./components/views/SettingsView'));

function ViewLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <span className="text-[10px] text-zinc-600 tracking-wider">LOADING MODULE</span>
      </div>
    </div>
  );
}

function ViewRouter() {
  const activeView = useUIStore((s) => s.activeView);

  return (
    <Suspense fallback={<ViewLoader />}>
      {(() => {
        switch (activeView) {
          case 'map': return <FullMapView />;
          case 'telemetry': return <TelemetryView />;
          case 'intel':
          case 'entities':
          case 'timeline':
            return <IntelView />;
          case 'analytics': return <AnalyticsView />;
          case 'missions': return <MissionView />;
          case 'settings': return <SettingsView />;
          case 'dashboard':
          default:
            return <DashboardView />;
        }
      })()}
    </Suspense>
  );
}

export default function App() {
  return (
    <Shell>
      <ViewRouter />
    </Shell>
  );
}
