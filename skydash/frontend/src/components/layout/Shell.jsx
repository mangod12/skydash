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
import OnboardingTour from '../common/OnboardingTour';
import NotificationCenter from '../common/NotificationCenter';
import ToastContainer, { toast } from '../common/Toast';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useAlertEngine } from '../../hooks/useAlertEngine';
import { useKeyboard } from '../../hooks/useKeyboard';
import useAuditIntegration from '../../hooks/useAuditIntegration';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useUIStore } from '../../stores/uiStore';

export default function Shell({ children }) {
  const [showHelp, setShowHelp] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const { notificationOpen, setNotificationOpen, toggleNotifications, isMobile, setResponsive, theme, workspace } = useUIStore();
  const prevAlertCountRef = useRef(0);

  useTelemetry();
  useAlertEngine();
  useAuditIntegration();
  useKeyboard({ onHelp: () => setShowHelp(true) });

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
    toast('System online — telemetry streaming', 'success');
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

      <div className="h-screen w-screen flex bg-[var(--surface-0)] text-zinc-100 overflow-hidden">
        {!isMobile && <Sidebar />}

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onInfoOpen={() => setShowInfo(true)} onNotificationToggle={toggleNotifications} />

          <main className={`flex-1 min-h-0 overflow-hidden ${isMobile ? 'pb-14' : ''}`}>
            {children}
          </main>

          <StatusBar />
        </div>

        <CommandPalette />
        <KeyboardHelp open={showHelp} onClose={() => setShowHelp(false)} />
        <InfoPanel open={showInfo} onClose={() => setShowInfo(false)} />
        <NotificationCenter isOpen={notificationOpen} onClose={() => setNotificationOpen(false)} />
        <ConnectionLost />
      </div>

      {isMobile && <BottomNav />}

      <OnboardingTour />

      {/* Ambient effects */}
      <ScanLine />
      <NoiseOverlay />
      <ToastContainer />
    </>
  );
}
