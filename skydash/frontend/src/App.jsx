import { lazy, Suspense, useEffect } from 'react';
import Shell from './components/layout/Shell';
import DashboardView from './components/views/DashboardView';
import FullMapView from './components/views/FullMapView';
import IntelView from './components/views/IntelView';
import LoginScreen from './components/common/LoginScreen';
import { useUIStore } from './stores/uiStore';
import { useAuthStore } from './stores/authStore';

const TelemetryView = lazy(() => import('./components/views/TelemetryView'));
const AnalyticsView = lazy(() => import('./components/views/AnalyticsView'));
const MissionView = lazy(() => import('./components/views/MissionView'));
const ScenarioLabView = lazy(() => import('./components/views/ScenarioLabView'));
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
          case 'scenario': return <ScenarioLabView />;
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
  const token = useAuthStore((s) => s.token);
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  if (authEnabled && !token) return <LoginScreen />;

  return (
    <Shell>
      <ViewRouter />
    </Shell>
  );
}
