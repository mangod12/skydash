import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import CommandPalette from '../common/CommandPalette';
import BootSequence from '../common/BootSequence';
import ScanLine from '../common/ScanLine';
import NoiseOverlay from '../common/NoiseOverlay';
import KeyboardHelp from '../common/KeyboardHelp';
import ConnectionLost from '../common/ConnectionLost';
import ToastContainer, { toast } from '../common/Toast';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useTelemetryStore } from '../../stores/telemetryStore';

export default function Shell({ children }) {
  const [showHelp, setShowHelp] = useState(false);
  const prevAlertCountRef = useRef(0);

  useTelemetry();
  useKeyboard({ onHelp: () => setShowHelp(true) });

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
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />

          <main className="flex-1 min-h-0 overflow-hidden">
            {children}
          </main>

          <StatusBar />
        </div>

        <CommandPalette />
        <KeyboardHelp open={showHelp} onClose={() => setShowHelp(false)} />
        <ConnectionLost />
      </div>

      {/* Ambient effects */}
      <ScanLine />
      <NoiseOverlay />
      <ToastContainer />
    </>
  );
}
