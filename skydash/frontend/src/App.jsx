import Shell from './components/layout/Shell';
import DashboardView from './components/views/DashboardView';
import FullMapView from './components/views/FullMapView';
import TelemetryView from './components/views/TelemetryView';
import IntelView from './components/views/IntelView';
import AnalyticsView from './components/views/AnalyticsView';
import SettingsView from './components/views/SettingsView';
import { useUIStore } from './stores/uiStore';

function ViewRouter() {
  const activeView = useUIStore((s) => s.activeView);

  switch (activeView) {
    case 'map': return <FullMapView />;
    case 'telemetry': return <TelemetryView />;
    case 'intel':
    case 'entities':
    case 'timeline':
      return <IntelView />;
    case 'analytics': return <AnalyticsView />;
    case 'settings': return <SettingsView />;
    case 'dashboard':
    default:
      return <DashboardView />;
  }
}

export default function App() {
  return (
    <Shell>
      <ViewRouter />
    </Shell>
  );
}
