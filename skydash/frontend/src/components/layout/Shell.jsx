import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import BottomNav from './BottomNav';
import CommandPalette from '../common/CommandPalette';
import BootSequence from '../common/BootSequence';
import ScanLine from '../common/ScanLine';
import NoiseOverlay from '../common/NoiseOverlay';
import KeyboardHelp from '../common/KeyboardHelp';
import InfoPanel from '../common/InfoPanel';
import ConnectionLost from '../common/ConnectionLost';
import ThreatBar from './ThreatBar';
import OnboardingTour from '../common/OnboardingTour';
import NotificationCenter from '../common/NotificationCenter';
import MiniConsole from '../common/MiniConsole';
import QuickActions from '../common/QuickActions';
import ToastContainer, { toast } from '../common/Toast';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useAlertEngine } from '../../hooks/useAlertEngine';
import { useKeyboard } from '../../hooks/useKeyboard';
import useAuditIntegration from '../../hooks/useAuditIntegration';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useUIStore } from '../../stores/uiStore';
import { BACKEND_CONFIGURED } from '../../utils/runtimeConfig';

export default function Shell({ children }) {
  const [showHelp, setShowHelp] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const { notificationOpen, setNotificationOpen, toggleNotifications, isMobile, setResponsive, theme, workspace, consoleOpen, setConsoleOpen } = useUIStore();
  const prevAlertCountRef = useRef(0);

  useTelemetry();
  useAlertEngine();
  useAuditIntegration();
  useKeyboard({ onHelp: () => setShowHelp((v) => !v) });

  // Responsive breakpoint listener
  useEffect(() => {
    let timeoutId = null;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setResponsive(window.innerWidth), 150);
    };
    setResponsive(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [setResponsive]);

  // Apply theme attribute to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Workspace change toast
  const prevWorkspaceRef = useRef(workspace);
  useEffect(() => {
    if (prevWorkspaceRef.current !== workspace) {
      toast(`Workspace: ${workspace.toUpperCase()} mode active`, 'success');
      prevWorkspaceRef.current = workspace;
    }
  }, [workspace]);

  const handleBootComplete = useCallback(() => {
    if (!BACKEND_CONFIGURED) {
      toast('Static demo ready - no backend connected', 'success');
      return;
    }
    toast('System online - telemetry streaming', 'success');
  }, []);

  // Alert toasts
  const alerts = useTelemetryStore((s) => s.alerts);
  useEffect(() => {
    if (alerts.length > prevAlertCountRef.current) {
      const newAlert = alerts[alerts.length - 1];
      toast(newAlert.message, newAlert.severity === 'critical' ? 'error' : 'warning');
    }
    prevAlertCountRef.current = alerts.length;
  }, [alerts]);

  return (
    <>
      <BootSequence onComplete={handleBootComplete} />

      <div className="h-screen w-screen flex flex-col bg-[var(--surface-0)] text-zinc-100 overflow-hidden">
        <ThreatBar />
        <div className="flex flex-1 min-h-0">
        {!isMobile && <Sidebar />}

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onInfoOpen={() => setShowInfo(true)} onNotificationToggle={toggleNotifications} />

          <main className={`flex-1 min-h-0 overflow-hidden ${isMobile ? 'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]' : ''}`}>
            {children}
          </main>

          {!isMobile && <StatusBar />}
        </div>

        <CommandPalette />
        <KeyboardHelp open={showHelp} onOpen={() => setShowHelp(true)} onClose={() => setShowHelp(false)} />
        <InfoPanel open={showInfo} onClose={() => setShowInfo(false)} />
        <NotificationCenter isOpen={notificationOpen} onClose={() => setNotificationOpen(false)} />
        <ConnectionLost />
        </div>
      </div>

      {isMobile && <BottomNav />}

      <QuickActions />
      <OnboardingTour />

      {/* Ambient effects */}
      <ScanLine />
      <NoiseOverlay />
      <MiniConsole open={consoleOpen} onClose={() => setConsoleOpen(false)} />
      <ToastContainer />
    </>
  );
}
